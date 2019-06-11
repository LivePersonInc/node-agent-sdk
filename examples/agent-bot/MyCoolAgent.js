'use strict';

/*
 * This demo try to use most of the API calls of the mssaging agent api. It:
 *
 * 1) Registers the agent as online
 * 2) Accepts any routing task (== ring)
 * 3) Publishes to the conversation the consumer info when it gets new conversation
 * 4) Gets the content of the conversation
 * 5) Emit 'MyCoolAgent.ContentEvnet' to let the developer handle contentEvent responses
 * 6) Mark as 'read' the handled messages
 *
 */

const Agent = require('./../../lib/AgentSDK');


class MyCoolAgent extends Agent {
    constructor(conf) {
        super(conf);
        this.conf = conf;
        this.init();
        this.CONTENT_NOTIFICATION = 'MyCoolAgent.ContentEvnet';
        this.consumerId = undefined;
    }

    init() {
        let openConvs = {};
        /** Needed for transfer back to bot flow **/
        this.firstSequence = [];
        this.lastSequence = [];

        this.on('connected', msg => {
            console.log('connected...', this.conf.id || '', msg);
            this.setAgentState({availability: 'ONLINE'});
            this.subscribeExConversations({
                'agentIds': [this.agentId],
                'convState': ['OPEN']
            }, (e, resp) => console.log('subscribeExConversations', this.conf.id || '', resp || e));
            this.subscribeRoutingTasks({});
            this._pingClock = setInterval(this.getClock, 30000);
        });

        // Accept any routingTask (==ring)
        this.on('routing.RoutingTaskNotification', body => {
            body.changes.forEach(c => {
                if (c.type === 'UPSERT') {
                    c.result.ringsDetails.forEach(r => {
                        if (r.ringState === 'WAITING') {
                            this.updateRingState({
                                'ringId': r.ringId,
                                'ringState': 'ACCEPTED'
                            }, (e, resp) => console.log(resp));
                        }
                    });
                }
            });
        });

        // Notification on changes in the open consversation list
        this.on('cqm.ExConversationChangeNotification', notificationBody => {
            notificationBody.changes.forEach(change => {
                if (change.type === 'UPSERT' && !openConvs[change.result.convId]) {
                    // new conversation for me
                    openConvs[change.result.convId] = {};

                    // demonstraiton of using the consumer profile calls
                    this.consumerId = change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id;
                    this.getUserProfile(this.consumerId, (e, profileResp) => {
                        this.publishEvent({
                            dialogId: change.result.convId,
                            event: {
                                type: 'ContentEvent',
                                contentType: 'text/plain',
                                message: `Just joined to conversation with ${JSON.stringify(profileResp)}`
                            }
                        });
                    });
                    this.subscribeMessagingEvents({dialogId: change.result.convId});
                } else if(change.type === 'UPSERT' && openConvs[change.result.convId] && change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id !== this.consumerId) {
                    // ConsumerID changed. Typically, a Step Up from an unauthenticated to an authenticated user.
                    this.consumerId = change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id;
                    this.getUserProfile(this.consumerId, (e, profileResp) => {
                        this.publishEvent({
                            dialogId: change.result.convId,
                            event: {
                                type: 'ContentEvent',
                                contentType: 'text/plain',
                                message: `Consumer stepped up in conversation with ${JSON.stringify(profileResp)}`
                            }
                        });
                    });
                } else if (change.type === 'DELETE') {
                    // conversation was closed or transferred
                    delete openConvs[change.result.convId];
                    delete this.firstSequence[change.result.convId];
                    delete this.lastSequence[change.result.convId];
                }
            });
        });

        // Echo every unread consumer message and mark it as read
        this.on('ms.MessagingEventNotification', body => {
            const respond = {};
            body.changes.forEach(c => {
                // add to respond list all content events not by the bot and only consumer events
                if (c.event.type === 'ContentEvent' && c.originatorId !== this.agentId && c.originatorMetadata.role === 'CONSUMER') {

                    if (typeof this.firstSequence[body.dialogId] === 'undefined') {
                        this.firstSequence[body.dialogId] = c.sequence;
                    }

                    respond[`${body.dialogId}-${c.sequence}`] = {
                        dialogId: body.dialogId,
                        sequence: c.sequence,
                        message: c.event.message
                    };

                    this.lastSequence[body.dialogId] = c.sequence;
                }

                // remove from respond list all the messages that were already read by the bot
                if (c.event.type === 'AcceptStatusEvent' && c.originatorId === this.agentId) {
                    c.event.sequenceList.forEach(seq => {
                        delete respond[`${body.dialogId}-${seq}`];
                    });
                }

                // if an assigned agent has already responded to a message from a visitor, the bot won't respond to it
                if (c.event.type === 'ContentEvent' && c.originatorId !== this.agentId && (c.originatorMetadata.role === 'ASSIGNED_AGENT' || c.originatorMetadata.role === 'MANAGER')) {
                    for (let i = this.firstSequence[body.dialogId]; i <= this.lastSequence[body.dialogId]; i++) {
                        delete respond[`${body.dialogId}-${i}`];
                    }
                }
            });

            // publish read, and echo
            Object.keys(respond).forEach(key => {
                let contentEvent = respond[key];
                this.publishEvent({
                    dialogId: contentEvent.dialogId,
                    event: {type: 'AcceptStatusEvent', status: 'READ', sequenceList: [contentEvent.sequence]}
                });
                this.emit(this.CONTENT_NOTIFICATION, contentEvent);
            });
        });

        // Tracing
        //this.on('notification', msg => console.log('got message', msg));
        this.on('error', err => console.log('got an error', err));
        this.on('closed', data => {
            // For production environments ensure that you implement reconnect logic according to
            // liveperson's retry policy guidelines: https://developers.liveperson.com/guides-retry-policy.html
            console.log('socket closed', data);
            clearInterval(this._pingClock);
        });
    }
}

module.exports = MyCoolAgent;
