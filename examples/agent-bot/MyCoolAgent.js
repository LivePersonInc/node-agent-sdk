'use strict';

/*
 * This demo try to use most of the API calls of the messaging agent api. It:
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

        this.CONTENT_NOTIFICATION = 'MyCoolAgent.ContentEvnet'; // TODO fix spelling mistake?

        this.consumerId = undefined; // TODO move this to the openConvs, otherwise this agent can only handle 1 consumer at a time

        this.openConvs = {};
        this.respond = {};

        this.on('connected', this.onConnected.bind(this));

        // handle incoming routing tasks or "rings"
        this.on('routing.RoutingTaskNotification', this.onRoutingTask.bind(this));

        // handle conversation state change notifications
        this.on('cqm.ExConversationChangeNotification', this.onConversationNotification.bind(this));

        // handle incoming messages (also message meta events like accept/read/typing/active)
        this.on('ms.MessagingEventNotification', this.onMessagingNotification.bind(this));

        this.on('error', err => console.log('got an error', err));

        this.on('closed', data => {
            // For production environments ensure that you implement reconnect logic according to
            // liveperson's retry policy guidelines: https://developers.liveperson.com/guides-retry-policy.html
            console.log('socket closed', data);

            // stop keep alive
            clearInterval(this._pingClock);
        });
    }

    onConnected(msg) {
        console.log('connected...', this.conf.id || '', msg);

        // tell UMS that this agent is online
        this.setAgentState({availability: 'ONLINE'});

        // subscribe to conversation updates
        this.subscribeExConversations({
            'agentIds': [this.agentId],
            'convState': ['OPEN']
        }, (e, resp) => console.log('subscribeExConversations', this.conf.id || '', resp || e));

        // tell UMS to send routing tasks
        this.subscribeRoutingTasks({});

        // start the keep alive process
        this._pingClock = setInterval(this.getClock, 30000);
    }

    onRoutingTask(body) {
        // Accept any routingTask (==ring)
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
    }

    onConversationNotification(notificationBody) {
        notificationBody.changes.forEach(change => {

            if (change.type === 'UPSERT') {

                // a new conversation
                if (!this.openConvs[change.result.convId]) {
                    this.onNewConversation(change);
                }

                // an existing conversation, but the consumerId changed
                // Typically, a Step Up from an unauthenticated to an authenticated user.
                else if (change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id !== this.consumerId) {
                    this.onConversationConsumerChange(change);
                }
            }

            else if (change.type === 'DELETE') {
                // conversation was closed or transferred
                delete this.openConvs[change.result.convId];
            }

        });
    }

    onNewConversation(change) {
        // add it to our list of known conversations
        this.openConvs[change.result.convId] = {
            seenSequences: {}
        };

        // take note of the consumerId
        this.consumerId = change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id;

        // get the user profile for this consumer
        this.getUserProfile(this.consumerId, (e, profileResp) => {

            // then send a message with this info
            this.publishEvent({
                dialogId: change.result.convId,
                event: {
                    type: 'ContentEvent',
                    contentType: 'text/plain',
                    message: `Just joined to conversation with ${JSON.stringify(profileResp)}`
                }
            });
        });

        // request all previous messages
        this.subscribeMessagingEvents({dialogId: change.result.convId});
    }

    onConversationConsumerChange(change) {
        // take note of the new consumerId
        this.consumerId = change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id;

        // get the user profile for the new consumer
        this.getUserProfile(this.consumerId, (e, profileResp) => {

            // then send a message with this info
            this.publishEvent({
                dialogId: change.result.convId,
                event: {
                    type: 'ContentEvent',
                    contentType: 'text/plain',
                    message: `Consumer stepped up in conversation with ${JSON.stringify(profileResp)}`
                }
            });
        });
    }

    // Echo every unread consumer message and mark it as read
    onMessagingNotification(body) {

        // respond to each message
        body.changes.forEach(this.onMessage.bind(this));

        // publish read, and echo
        // this is a bad practice, it could send duplicates if message notifications are received to quickly
        // TODO just move this to the place where we add things to this.respond
        Object.keys(this.respond).forEach(key => {
            let contentEvent = this.respond[key];
            this.publishEvent({
                dialogId: contentEvent.dialogId,
                event: {type: 'AcceptStatusEvent', status: 'READ', sequenceList: [contentEvent.sequence]}
            });
            this.emit(this.CONTENT_NOTIFICATION, contentEvent);
        });
    }

    onMessage(c) {
        // In the current version MessagingEventNotification are received also without subscription
        // Will be fixed in the next api version. So we have to check if this notification is handled by us.
        if (!this.openConvs[c.dialogId]) { return; }

        // TODO ignore messages with a sequence in seenSequences

        // if the message is not from this agent, add it to a list of messages that we need to send an "accept" message for
        if (c.event.type === 'ContentEvent' && c.originatorId !== this.agentId) {
            let key = `${c.dialogId}-${c.sequence}`;
            this.respond[key] = {
                dialogId: c.dialogId,
                sequence: c.sequence,
                message: c.event.message
            };
        }

        // when this agent's accept messages arrive, check off the message from the list of pending accept messages
        if (c.event.type === 'AcceptStatusEvent' && c.originatorId === this.agentId) {
            c.event.sequenceList.forEach(seq => {
                delete this.respond[`${c.dialogId}-${seq}`];
            });
        }
    }

}

module.exports = MyCoolAgent;
