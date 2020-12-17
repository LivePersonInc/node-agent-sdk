'use strict';

/*
 * This demo try to use most of the API calls of the messaging agent api. It:
 *
 * 1) Registers the agent as online
 * 2) Accepts any routing task (== ring)
 * 3) Publishes to the conversation the consumer info when it gets new conversation
 * 4) Gets the content of the conversation
 * 5) Emit 'MyCoolAgent.ContentEvent' to let the developer handle contentEvent responses
 * 6) Mark as 'read' the handled messages
 *
 */

const Agent = require('./../../lib/AgentSDK');


class MyCoolAgent extends Agent {

    constructor(conf) {
        super(conf);

        this.conf = conf;

        this.CONTENT_NOTIFICATION_LEGACY = 'MyCoolAgent.ContentEvnet'; // deprecated, some old bots might still use this, but example code will not reference this
        this.CONTENT_NOTIFICATION = 'MyCoolAgent.ContentEvent';
        this.NEW_CONVERSATION = 'MyCoolAgent.NewConversation';

        this.openConvs = {};

        this.on('connected', this.onConnected.bind(this));

        // handle incoming routing tasks or "rings"
        this.on('routing.RoutingTaskNotification', this.onRoutingTask.bind(this));

        // handle conversation state change notifications
        this.on('cqm.ExConversationChangeNotification', this.onConversationNotification.bind(this));

        // handle incoming messages (also message meta events like accept/read/typing/active)
        this.on('ms.MessagingEventNotification', this.onMessagingNotification.bind(this));

        this.on('error', (err) => {
            console.log('got an error', err);
        });

        this.on('closed', data => {
            // For production environments ensure that you implement reconnect logic according to
            // liveperson's retry policy guidelines: https://developers.liveperson.com/guides-retry-policy.html
            console.log('socket closed', data);

            // stop keep alive
            clearInterval(this._pingClock);

            // mark all convs as offline
            Object.keys(this.openConvs).forEach(key => {
                this.openConvs[key].state = 'offline';
            });

            // then reconnect
            this.reconnectWithMessages();
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

    reconnectWithMessages() {
        console.log('reconnecting');
        this.reconnect(); // regenerate token for reasons of authorization (data === 4401 || data === 4407)
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

                // an existing conversation
                else {

                    // look up the conversation state
                    let conversation = this.openConvs[change.result.convId];

                    // this is the first time we've seen this since reconnect
                    if (conversation.state === 'offline') {
                        conversation.state = 'active';
                        console.log('conversation resumed after being online');

                        // request all previous messages to make sure that none were missed while the connection was down
                        this.subscribeMessagingEvents({dialogId: change.result.convId});
                    }

                    // handle consumerId change
                    // Typically, a Step Up from an unauthenticated to an authenticated user.
                    if (change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id !== conversation.consumerId) {
                        this.onConversationConsumerChange(change);
                    }
                }
            }

            else if (change.type === 'DELETE') {
                setTimeout(() => {

                    if (this.openConvs.hasOwnProperty(change.result.convId)) {
                        // conversation was closed or transferred
                        delete this.openConvs[change.result.convId];
                    }

                }, 1000);
            }

        });
    }

    onNewConversation(change) {

        // create a conversation state object
        let conversation = {
            messages: {},
            consumerId: null,
            state: 'active'
        };

        // add it to our list of known conversations
        this.openConvs[change.result.convId] = conversation;

        // take note of the consumerId
        conversation.consumerId = change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id;

        // get the user profile for this consumer
        this.getUserProfile(conversation.consumerId, (e, profileResp) => {

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

        // tell listeners about this conversation
        this.emit(this.NEW_CONVERSATION, {change, conversation});
    }

    onConversationConsumerChange(change) {

        let conversation = this.openConvs[change.result.convId];

        // take note of the new consumerId
        conversation.consumerId = change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id;

        // get the user profile for the new consumer
        this.getUserProfile(conversation.consumerId, (e, profileResp) => {

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

        // process messages for read, mainly for preventing duplicate read messages from being sent on queryMessages
        body.changes.forEach(c => {

            // get conversation state
            let conversation = this.openConvs[c.dialogId];

            // handle read receipts
            if (c.event.type === 'AcceptStatusEvent' && c.event.status === 'READ') {
                c.event.sequenceList.forEach(sequence => {
                    if (!conversation.messages.hasOwnProperty(sequence)) {
                        console.log(`invalid sequence: ${sequence}`);
                    }
                    else {
                        conversation.messages[sequence].readStatus = 'RECEIVED';
                    }
                });
            }

        });

        // send read for any messages that need it
        body.changes.forEach(c => {
            // if the message is not from this agent, add it to a list of messages that we need to send an "accept" message for
            if (c.event.type === 'ContentEvent' && c.originatorId !== this.agentId) {

                // get conversation state
                let conversation = this.openConvs[c.dialogId];

                // if we've already sent or received a read, do nothing
                if (conversation.messages[c.sequence].readStatus !== 'NOT_SENT') return;

                // mark it so we don't do twice
                conversation.messages[c.sequence].readStatus = 'PENDING';

                // send a read response, indicating that the agent has read this message
                this.publishEvent({
                    dialogId: c.dialogId,
                    event: {type: 'AcceptStatusEvent', status: 'READ', sequenceList: [c.sequence]}
                });

            }
        });

    }

    onMessage(c) {
        // In the current version MessagingEventNotification are received also without subscription
        // Will be fixed in the next api version. So we have to check if this notification is handled by us.
        if (!this.openConvs[c.dialogId]) { return; }

        // get conversation state
        let conversation = this.openConvs[c.dialogId];

        // check for duplicate message by sequence
        if (conversation.messages.hasOwnProperty(c.sequence)) {
            console.log(`ignoring duplicate message ${c.sequence}`);
            return;
        }

        // store this message
        conversation.messages[c.sequence] = c.event;
        conversation.messages[c.sequence].readStatus = 'NOT_SENT';

        // if this is a contentEvent from anybody other than the current agent...
        if (c.event.type === 'ContentEvent' && c.originatorId !== this.agentId) {

            // emit the message to any listeners
            let contentEvent = {
                dialogId: c.dialogId,
                sequence: c.sequence,
                message: c.event.message
            };

            this.emit(this.CONTENT_NOTIFICATION, contentEvent);
            this.emit(this.CONTENT_NOTIFICATION_LEGACY, contentEvent);
        }
    }

}

module.exports = MyCoolAgent;
