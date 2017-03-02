'use strict';

/*
 * This demo try to use most of the API calls of the mssaging agent api. It:
 * 
 * 1) Registers the agent as online
 * 2) Accepts any routing task
 * 3) Publishes to the conversation the consumer info when it gets new conversation
 * 4) Gets the content of the conversation
 * 5) Echo any new message from the consumer
 * 6) Mark as "read" the echoed message
 * 7) Close the conversation if the consumer message starts with '#close'
 * 
 */

const Agent = require('./../lib/AgentSDK');

const agent = new Agent({
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS,
    csdsDomain: process.env.LP_CSDS // 'hc1n.dev.lprnd.net'
});

let openConvs = {};

agent.on('connected', msg => {
    console.log('connected...');
    agent.setAgentState({availability: "ONLINE"});
    agent.subscribeExConversations({
        'convState': ['OPEN']
    }, (e, resp) => console.log('subscribed successfully'));
    agent.subscribeRoutingTasks({}, (e, resp) => console.log(resp));
});

// Accept any ring
agent.on('routing.RoutingTaskNotification', body => {
    body.changes.forEach(c => {
        if (c.type === "UPSERT") {
            c.result.ringsDetails.forEach(r => {
                if (r.ringState === 'WAITING') {
                    agent.updateRingState({
                        "ringId": r.ringId,
                        "ringState": "ACCEPTED"
                    }, (e, resp) => console.log(resp));
                }
            });
        }
    });
});

// Subscribe to the content of my conversations
agent.on('cqm.ExConversationChangeNotification', notificationBody => {
    notificationBody.changes.forEach(change => {
        if (change.type === 'UPSERT') {
            if (openConvs[change.result.convId] && change.result.conversationDetails.getMyRole() !== "ASSIGNED_AGENT") {
                // conversation was transfered
                delete openConvs[change.result.convId];
            }
            if (!openConvs[change.result.convId] && change.result.conversationDetails.getMyRole() === "ASSIGNED_AGENT") {
                // new conversation for me
                openConvs[change.result.convId] = {};
                const consumerId = change.result.conversationDetails.participants.filter(p => p.role === "CONSUMER")[0].id;
                agent.getUserProfile(consumerId, (e, profileResp) => {
                    agent.publishEvent({
                        dialogId: change.result.convId,
                        event: {
                            type: 'ContentEvent',
                            contentType: 'text/plain',
                            message: `Just joined to conversation with ${JSON.stringify(profileResp)}`
                        }
                    });
                });
                agent.subscribeMessagingEvents({dialogId: change.result.convId});
            }
        } else if (change.type === 'DELETE') {
            // conversation was closed
            delete openConvs[change.result.convId];
        }
    });
});

// Echo every unread consumer message and mark it as read
agent.on('ms.MessagingEventNotification', body => {
    const respond = {};
    body.changes.forEach(c => {
        // In the current version MessagingEventNotification are recived also without subscription
        // Will be fixed in the next api version. So we have to check if this notification is handled by us.
        if (openConvs[c.dialogId]) {
            // add to respond list all content event not by me
            if (c.event.type === 'ContentEvent' && !c.isMe()) {
                respond[`${body.dialogId}-${c.sequence}`] = {
                    dialogId: body.dialogId,
                    sequence: c.sequence,
                    message: c.event.message
                };
                // Close the conversation upon #close message from the consumer
                if (c.event.message.startsWith('#close')) {
                    agent.updateConversationField({
                        conversationId: body.dialogId,
                        conversationField: {
                            field: "ConversationStateField",
                            conversationState: "CLOSE"
                        }
                    });
                }
            }
            // remove from respond list all the messages that were already read
            if (c.event.type === 'AcceptStatusEvent' && c.isMe()) {
                c.event.sequenceList.forEach(seq => {
                    delete respond[`${body.dialogId}-${seq}`];
                });
            }
        }
    });

    // publish read, and echo
    Object.keys(respond).forEach(key => {
        var contentEvent = respond[key];
        agent.publishEvent({
            dialogId: contentEvent.dialogId,
            event: {type: "AcceptStatusEvent", status: "READ", sequenceList: [contentEvent.sequence]}
        });
        agent.publishEvent({
            dialogId: contentEvent.dialogId,
            event: {type: 'ContentEvent', contentType: 'text/plain', message: `echo : ${contentEvent.message}`}
        });
    });
});

// Tracing
//agent.on('notification', msg => console.log('got message', msg));
//agent.on('error', err => console.log('got an error', err));
//agent.on('closed', data => console.log('socket closed', data));
