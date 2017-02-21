'use strict';

const Agent = require('./../lib/AgentSDK');
const accountId = process.env.LP_ACCOUNT;
const username = process.env.LP_USER;
const password = process.env.LP_PASS;

const agent = new Agent({
    accountId: accountId,
    username: username,
    password: password,
    csdsDomain: 'hc1n.dev.lprnd.net'
});

let subscriptionId;
let openConvs = {};

agent.on('connected', msg => {
    console.log('connected...');
    agent.setAgentState({ availability: "OFFLINE"});
    agent.subscribeExConversations({
        'convState': ['OPEN']
    }, (err, resp) => {
        subscriptionId = resp.subscriptionId;
        console.log('subscribed successfully', err, resp);
    });
});

agent.on('notification', msg => {
    console.log('got message', msg);
    if (msg.body.subscriptionId === subscriptionId) {
        handleConversationNotification(msg.body, openConvs)
    }
});

agent.on('error', err => {
    console.log('got an error', err);
});

agent.on('closed', data => {
    console.log('socket closed', data);
});

function handleConversationNotification(notificationBody, openConvs) {
    notificationBody.changes.forEach(change => {
        if (change.type === 'UPSERT') {
            if (!openConvs[change.result.convId]) {
                openConvs[change.result.convId] = change.result;
                // console.log(change.result);
                if (!change.result.conversationDetails.participants.MANAGER || !change.result.conversationDetails.participants.MANAGER.includes(agent.agentId)) {
                    agent.updateConversationField({
                        'conversationId': change.result.convId,
                        'conversationField': [{
                            'field': 'ParticipantsChange',
                            'type': 'ADD',
                            'userId': agent.agentId,
                            'role': 'MANAGER'
                        }]
                    }, (err, joinResp) => {
                        console.log('added');
                        agent.queryMessages({
                            'dialogId': change.result.convId,
                            'newerThanSequence': '0'
                        }, (err, queryResp) => {
                            if (queryResp.filter(e => e.originatorPId !== change.result.conversationDetails.participantsPId.CONSUMER[0]).length == 0) {
                                console.log(`sending welcome to conv ${change.result.convId}\n`);
                                agent.publishEvent({
                                    dialogId: change.result.convId,
                                    event: {
                                        type: 'ContentEvent',
                                        contentType: 'text/plain',
                                        message: 'welcome from bot'
                                    }
                                });
                            }
                        });
                    });
                }
            }
        }
        else if (change.type === 'DELETE') {
            delete openConvs[change.result.convId];
            console.log(`conversation was closed.\n`);
        }
    });
}
