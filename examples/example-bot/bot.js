/**
 *  @author: Mark Manguno
 *  @description: LE Messaging Agent SDK implementation
 */

'use strict';

const Agent = require('node-agent-sdk').Agent;
const Winston = require('winston');

const log = new Winston.Logger({
    name: 'bot_log',
    transports: [new Winston.transports.Console({
        timestamp: true,
        colorize: true,
        level: process.env.loglevel || 'warn'
    })]
});

const CONST = {
    CONTENT_NOTIFICATION: 'Bot.Event.Content',
    CONVERSATION_NOTIFICATION: 'Bot.Event.Conversation',
    ROUTING_NOTIFICATION: 'Bot.Event.Routing',
    AGENT_STATE_NOTIFICATION: 'Bot.Event.AgentState',
    CONNECTED: 'Bot.Connected',
    SOCKET_CLOSED: 'Bot.SocketClosed',
    ERROR: 'Bot.Error',

};

class Bot extends Agent {
    constructor(config, initialState = 'ONLINE', subscribeAllConversations = false, clockPingInterval = 300000) {
        super(config);
        this.config = config;
        this.initialState = initialState;
        this.clockPingInterval = clockPingInterval;
        this.subscribeAllConversations = subscribeAllConversations;
        this.CONST = CONST;
        this.init();
    }

    init() {
        // In the current version of the Messaging Agent API MessagingEventNotifications are received for all conversations,
        // even those to which you have not explicitly subscribed. This automatic subscription is error-prone, though,
        // so you must still explicitly subscribe to those conversations you want updates for.
        // For this reason it is necessary to keep a list of the conversations whose messagingEventNotifications you really
        // want to consume and respond to.
        this.myConversations = {};

        this.on('connected', (message) => {
            clearInterval(this._retryConnection);
            log.info(`[bot.js] connected: ${JSON.stringify(message)}`);
            this.emit(this.CONST.CONNECTED, message);

            // Get server clock at a regular interval in order to keep the connection alive
            _getClock(this);
            this._pingClock = setInterval(() => {_getClock(this)}, this.clockPingInterval);

            // Subscribe to Agent State notifications
            this.subscribeAgentsState({}, (e, resp) => {
                if (e) { log.error(`[bot.js] subscribeAgentState: ${JSON.stringify(e)}`) }
                else { log.info(`[bot.js] subscribeAgentsState: ${JSON.stringify(resp)}`) }
            });

            // Set initial agent state
            this.setAgentState({ availability: this.initialState }, (e, resp) => {
                if (e) { log.error(`[bot.js] setAgentState: ${JSON.stringify(e)}`) }
                else { log.info(`[bot.js] setAgentState: ${JSON.stringify(resp)}`) }
            });

            // Subscribe to Conversation Notifications
            let convSubParams = {'convState': ['OPEN']};
            if (!this.subscribeAllConversations) convSubParams.agentIds = [this.agentId];
            this.subscribeExConversations(convSubParams, (e, resp) => {
                if (e) { log.error(`[bot.js] subscribeExConversations: ${JSON.stringify(e)}`) }
                else { log.info(`[bot.js] subscribeExConversations: ${JSON.stringify(resp)}`) }
            });

            // Subscribe to Routing Task notifications
            this.subscribeRoutingTasks({}, (e, resp) => {
                if (e) { log.error(`[bot.js] subscribeRoutingTasks: ${JSON.stringify(e)}`) }
                else { log.info(`[bot.js] subscribeRoutingTasks: ${JSON.stringify(resp)}`) }
            });

            // Log my agentId
            log.info(`[bot.js] agentId: ${this.agentId}`);
        });

        // Process routing tasks
        // Log them and emit an event
        this.on('routing.RoutingTaskNotification', body => {
            log.info(`[bot.js] routing.RoutingTaskNotification: ${JSON.stringify(body)}`);
            body.changes.forEach((change, index) => {
                log.silly(`[bot.js] routing.RoutingTaskNotification change ${index}: ${JSON.stringify(change)}`)
            });
            this.emit(this.CONST.ROUTING_NOTIFICATION, body);
        });

        // Process agent state notifications
        // Log them and emit an event
        this.on('routing.AgentStateNotification', body => {
            log.info(`[bot.js] routing.AgentStateNotification: ${JSON.stringify(body)}`);
            body.changes.forEach((change, index) => {
                log.silly(`[bot.js] routing.AgentStateNotification change ${index}: ${JSON.stringify(change)}`);
            });
            this.emit(this.CONST.AGENT_STATE_NOTIFICATION, body);
        });

        // Process changes in the list of my open conversations
        // Log them and emit an event
        this.on('cqm.ExConversationChangeNotification', body => {
            log.info(`[bot.js] cqm.ExConversationChangeNotification: ${JSON.stringify(body)}`);
            body.changes.forEach((change, index) => {
                log.silly(`[bot.js] cqm.ExConversationChangeNotification change ${index}: ${(JSON.stringify(change.result.event)||'[no event]')} | ${JSON.stringify(change)}`);

                // When conversations are added or changed the event type will be 'UPSERT'
                if (change.type === 'UPSERT') {
                    // If this is the first time seeing this conversation add it to my list,
                    // get the consumer profile,
                    // and subscribe to messaging events
                    if (!this.isInMyConversationsList(change.result.convId)) {
                        // Add it to myConversations
                        this.myConversations[change.result.convId] = {};
                        log.silly(`[bot.js] ${change.result.convId} added to myConversations: ${JSON.stringify(this.myConversations)}`);

                        // Get the consumer profile
                        this.getConsumerProfile(change.result.convId, change.result.conversationDetails);

                        // Subscribe to messagingEvents
                        this.subscribeMessagingEvents({dialogId: change.result.convId}, (e, resp) => {});
                    }

                // The other type of event is 'DELETE', when conversations are removed from the subscription
                } else if (change.type === 'DELETE') {
                    // Remove the conversation from myConversations
                    delete this.myConversations[change.result.convId];
                    log.silly(`[bot.js] ${change.result.convId} removed from myConversations: ${JSON.stringify(this.myConversations)}`);
                }
            });

            this.emit(this.CONST.CONVERSATION_NOTIFICATION, body);
        });

        // Process messaging event notifications
        // Log them
        this.on('ms.MessagingEventNotification', body => {
            // log these notifications at info level (except ChatStateEvents, which are silly)
            if (!body.changes.find(change => {return change.event.type === 'ChatStateEvent';})) {
                log.info(`[bot.js] ms.MessagingEventNotification: ${JSON.stringify(body)}`);
            } else {
                log.silly(`[bot.js] ms.MessagingEventNotification: ${JSON.stringify(body)}`);
            }

            // Create a list of messages to handle
            const respond = {};
            body.changes.forEach(change => {
                log.silly(`[bot.js] ms.MessagingEventNotification: ${JSON.stringify(change.event)} | ${JSON.stringify(change)}`);

                if (this.isInMyConversationsList(change.dialogId)) { // This check is necessary because of the subscription bug
                    // add to respond list all content events not by me
                    if (change.event.type === 'ContentEvent' && change.originatorId !== this.agentId) {
                        respond[`${body.dialogId}-${change.sequence}`] = {
                            dialogId: body.dialogId,
                            sequence: change.sequence,
                            message: change.event.message,
                            originator: change.originatorMetadata
                        };
                    }
                    // remove from respond list all the messages that were already read
                    if (change.event.type === 'AcceptStatusEvent' && change.originatorId === this.agentId) {
                        change.event.sequenceList.forEach(seq => {
                            delete respond[`${body.dialogId}-${seq}`];
                        });
                    }
                }
            });

            // Mark messages as read and emit content notification
            Object.keys(respond).forEach(key => {
                let contentEvent = respond[key];
                this.markAsRead(contentEvent.dialogId, [contentEvent.sequence]);
                this.emit(this.CONST.CONTENT_NOTIFICATION, contentEvent);
            });

        });

        // TODO: remove after finding all message types
        // Handle unidentified notification types
        const handledMessageTypes = [
            'cqm.ExConversationChangeNotification',
            'ms.MessagingEventNotification',
            'routing.RoutingTaskNotification',
            'routing.AgentStateNotification'
        ];
        this.on('notification', msg => {
            if (!handledMessageTypes.includes(msg.type)) {
                log.error(`[bot.js] Got an unhandled message: ${msg.type} ${JSON.stringify(msg)}`)
            }
        });

        // Handle errors
        this.on('error', err => { log.error(`[bot.js] Got an unhandled error: ${JSON.stringify(err)}`) });

        // Handle socket closed
        this.on('closed', data => {
            clearInterval(this._pingClock);
            log.info(`[bot.js] socket closed: ${JSON.stringify(data)}`);
            let _this = this;
            this._retryConnection = setInterval(() => {
                log.info(`[bot.js] reconnecting`);
                _this.reconnect();
            }, 10000);
        });

        // Get the consumerProfile from a conversation
        this.getConsumerProfile = function (conversationId, conversationDetails) {
            const consumerId = conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id;
            this.getUserProfile(consumerId, (e, profileResp) => {
                if (e) log.error(`[bot.js] getUserProfile: ${JSON.stringify(e)}`);
                else {
                    log.info(`[bot.js] conversation ${conversationId} consumerProfile ${JSON.stringify(profileResp)}`);
                }
            });
        };

        // Accept ringing conversations
        this.acceptWaitingConversations = function (data) {
            data.changes.forEach(change => {
                if (change.type === "UPSERT") {
                    change.result.ringsDetails.forEach(ring => {
                        if (ring.ringState === 'WAITING') {
                            this.updateRingState({
                                "ringId": ring.ringId,
                                "ringState": "ACCEPTED"
                            }, (e, resp) => {
                                if (e) { log.error(`[bot.js] acceptWaitingConversations ${JSON.stringify(e)}`) }
                                else { log.info(`[bot.js] acceptWaitingConversations: Joined conversation ${JSON.stringify(change.result.conversationId)}`) }
                            });
                        }
                    });
                }
            });
        };

        // Join conversation
        // Possible roles include 'MANAGER', 'ASSIGNED_AGENT', 'READER'
        this.joinConversation = function (conversationId, role) {
            this.updateConversationField({
                'conversationId': conversationId,
                'conversationField': [{
                    'field': 'ParticipantsChange',
                    'type': 'ADD',
                    'role': role
                }]
            }, () => {
                this.publishEvent({
                    dialogId: conversationId,
                    event: {
                        type: 'ContentEvent',
                        contentType: 'text/plain',
                        message: role + ' joined'
                    }
                });
            })
        };

        // Send text
        this.sendText = function (conversationId, message) {
            log.silly(`[bot.js] sending text ${message} to conversation ${conversationId}`);
            this.publishEvent({
                dialogId: conversationId,
                event: {
                    type: 'ContentEvent',
                    contentType: 'text/plain',
                    message: message.toString()
                }
            }, (e) => {
                if (e) { log.error(`[bot.js] sendText ${message} ${JSON.stringify(e)}`) }
                else { log.silly(`[bot.js] sendText successful`)}
            })
        };

        // Mark message as "read"
        this.markAsRead = function (conversationId, sequenceArray) {
            this.publishEvent({
                dialogId: conversationId,
                event: {type: 'AcceptStatusEvent', status: 'READ', sequenceList: sequenceArray}
            }, (e) => {
                if (e) { log.error(`[bot.js] markAsRead ${JSON.stringify(e)}`) }
                else { log.silly(`[bot.js] markAsRead successful`)}
            });
        };

        // Transfer conversation to a new skill
        this.transferConversation = (conversationId, targetSkill) => {
            log.info(`[bot.js] transferring conversation ${conversationId} to skill ${targetSkill}`);
            this.updateConversationField({
                conversationId: conversationId,
                conversationField: [
                    {
                        field: 'ParticipantsChange',
                        type: 'REMOVE',
                        role: 'ASSIGNED_AGENT'
                    },
                    {
                        field: 'Skill',
                        type: 'UPDATE',
                        skill: targetSkill
                    }
                ]
            }, (e) => {
                if (e) { log.error(`[bot.js] transferConversation ${JSON.stringify(e)}`) }
                else { log.silly(`[bot.js] transferConversation successful`)}
            })
        };

        // Close conversation
        this.closeConversation = (conversationId) => {
            this.updateConversationField({
                'conversationId': conversationId,
                'conversationField': [
                    {
                        'field': 'ConversationStateField',
                        'conversationState': 'CLOSE'
                    }
                ]
            })
        };

        // Is a specific PID a participant in a specific conversation, and if so with what role?
        this.isPIDaParticipant = (convDetails, pid = this.agentId) => {
            let participant = convDetails.participants.filter(p => p.id === pid)[0];
            return participant && participant.role;
        };

        // Is this conversation in the "my conversations" list?
        this.isInMyConversationsList = (convId) => {
            return !!this.myConversations[convId];
        };

        // Get the server clock and compare it to the client clock.
        // Also used to periodically ping the server for keepalive.
        function _getClock (context) {
            let before = new Date();
            context.getClock({}, (e, resp) => {
                if (e) {log.error(`[bot.js] getClock: ${JSON.stringify(e)}`)}
                else {
                    let after = new Date();
                    log.silly(`[bot.js] getClock: request took ${after.getTime()-before.getTime()}ms, diff = ${resp.currentTime - after}`)
                }

            })
        }
    }
}

module.exports = Bot;
