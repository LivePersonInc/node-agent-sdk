/**
 *  @author: Mark Manguno
 *  @description: LE Messaging Agent SDK implementation
 */

'use strict';

const Agent = require('./../../../lib/AgentSDK');
const Winston = require('winston');

const log = new Winston.Logger({
    name: 'bot_log',
    transports: [new Winston.transports.Console({
        timestamp: true,
        colorize: true,
        level: process.env.loglevel || 'warn'
    })]
});

/**
 * Class representing a Bot agent.
 *
 * @extends Agent
 * @property {Function} on
 */
class Bot extends Agent {

    /**
     * Create a Bot
     *
     * @param {Object} config - Config object for agent as defined at https://github.com/LivePersonInc/node-agent-sdk#agent-class
     * @param {String} [initialState=ONLINE] - Bot's initial state. Acceptable values are 'ONLINE', 'OCCUPIED', 'AWAY'
     * @param {Boolean} [subscribeAllConversations=false] - If false, subscribe only to bot's conversations. If true, subscribe to all conversations
     * @param {Number} [clockPingInterval=300000] - Keep-alive interval in ms
     */
    constructor(config, initialState = 'ONLINE', subscribeAllConversations = false, clockPingInterval = 300000) {
        super(config);
        this.config = config;
        this.initialState = initialState;
        this.clockPingInterval = clockPingInterval;
        this.subscribeAllConversations = subscribeAllConversations;
        this.init();
    }

    static get const() {
        return {
            CONTENT_NOTIFICATION: 'Bot.Event.Content',
            CONVERSATION_NOTIFICATION: 'Bot.Event.Conversation',
            ROUTING_NOTIFICATION: 'Bot.Event.Routing',
            AGENT_STATE_NOTIFICATION: 'Bot.Event.AgentState',
            CONNECTED: 'Bot.Connected',
            SOCKET_CLOSED: 'Bot.SocketClosed',
            ERROR: 'Bot.Error'
        };
    }

    init() {
        /* In the current version of the Messaging Agent API MessagingEventNotifications are received for all
        conversations, even those to which you have not explicitly subscribed. This automatic subscription is
        error-prone, though, so you must still explicitly subscribe to those conversations you want updates for.
        For this reason it is necessary to keep a list of the conversations whose messagingEventNotifications
        you really want to consume and respond to. Regardless, it is a good practice to maintain such a list
        with important details about each conversation the bot is handling. */
        this.myConversations = {};

        /* Upon establishing a connection to the Messaging service start the periodic keep-alive mechanism,
        subscribe to Agent State notifications, set the bot agent's initial state, subscribe to conversation
        notifications, and subscribe to routing tasks */
        this.on('connected', (message) => {
            clearInterval(this._retryConnection);
            log.info(`[bot.js] connected: ${JSON.stringify(message)}`);
            this.emit(Bot.const.CONNECTED, message);

            // Get server clock at a regular interval in order to keep the connection alive
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
                log.silly(`[bot.js] routing.RoutingTaskNotification change ${index}: ${JSON.stringify(change)}`);
            });
            this.emit(Bot.const.ROUTING_NOTIFICATION, body);
        });

        // Process agent state notifications
        // Log them and emit an event
        this.on('routing.AgentStateNotification', body => {
            log.info(`[bot.js] routing.AgentStateNotification: ${JSON.stringify(body)}`);
            body.changes.forEach((change, index) => {
                log.silly(`[bot.js] routing.AgentStateNotification change ${index}: ${JSON.stringify(change)}`);
            });
            this.emit(Bot.const.AGENT_STATE_NOTIFICATION, body);
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
                    // get the consumer profile, and subscribe to messaging events
                    if (!this.isInMyConversationsList(change.result.convId)) {

                        // Add it to myConversations
                        this.addToMyConversations(change.result.convId);
                        log.silly(`[bot.js] ${change.result.convId} added to myConversations: ${JSON.stringify(this.myConversations)}`);

                        // Get the consumer profile
                        this.myConversations[change.result.convId].consumerProfile = this.getConsumerProfile(change.result.convId, change.result.conversationDetails);

                        // Subscribe to messagingEvents
                        this.subscribeMessagingEvents({dialogId: change.result.convId}, (e) => {
                            if (e) { log.error(`[bot.js] subscribeMessagingEvents: ${JSON.stringify(e)}`) }
                            else { log.info('[bot.js] subscribeMessagingEvents: success') }
                        });
                    }

                    // Update this conversation's details in my list
                    this.updateMyConversation(change.result.convId, change.result);

                // The other type of event is 'DELETE', when conversations are removed from the subscription
                } else if (change.type === 'DELETE') {
                    // Remove the conversation from myConversations
                    delete this.myConversations[change.result.convId];
                    log.silly(`[bot.js] ${change.result.convId} removed from myConversations: ${JSON.stringify(this.myConversations)}`);
                }
            });

            this.emit(Bot.const.CONVERSATION_NOTIFICATION, body);
        });

        // Process messaging event notifications
        // Log them, mark the message as read if relevant, and emit an event
        this.on('ms.MessagingEventNotification', body => {

            // log these notifications at info level (except ChatStateEvents, which are silly)
            if (!body.changes.find(change => {return change.event.type === 'ChatStateEvent'})) {
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
            if (this.myConversations[body.dialogId] &&
                this.isPIDaParticipant(this.myConversations[body.dialogId].conversationDetails) === 'ASSIGNED_AGENT') {
                Object.keys(respond).forEach(key => {
                    let contentEvent = respond[key];
                    this.markAsRead(contentEvent.dialogId, [contentEvent.sequence]);
                    this.emit(Bot.const.CONTENT_NOTIFICATION, contentEvent);
                });
            }
        });

        // Handle unidentified notification types
        // TODO: remove after finding all message types
        const handledMessageTypes = [
            'cqm.ExConversationChangeNotification',
            'ms.MessagingEventNotification',
            'routing.RoutingTaskNotification',
            'routing.AgentStateNotification'
        ];
        this.on('notification', msg => {
            if (!handledMessageTypes.includes(msg.type)) {
                log.error(`[bot.js] Got an unhandled message: ${msg.type} ${JSON.stringify(msg)}`);
            }
        });

        // Handle errors
        this.on('error', err => {
            log.error(`[bot.js] Got an unhandled error: ${JSON.stringify(err)}`);
            this.emit(Bot.const.ERROR, err);
        });

        // Handle socket closed
        this.on('closed', data => {
            clearInterval(this._pingClock);
            log.info(`[bot.js] socket closed: ${JSON.stringify(data)}`);
            let _this = this;
            this._retryConnection = setInterval(() => {
                log.info('[bot.js] reconnecting');
                _this.reconnect();
            }, 10000);
        });

        /**
         * Get the consumerProfile from a conversation
         *
         * @param {String} conversationId
         * @param {Object} conversationDetails
         */
        this.getConsumerProfile = function (conversationId, conversationDetails) {
            const consumerId = conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id;
            this.getUserProfile(consumerId, (e, resp) => {
                if (e) log.error(`[bot.js] getUserProfile: ${JSON.stringify(e)}`);
                else {
                    log.info(`[bot.js] conversation ${conversationId} consumerProfile ${JSON.stringify(resp)}`);
                }
            });
        };

        /**
         * Accept ringing conversations
         *
         * @param {Object} data - The entire body of a routingStatusNotification
         * @param {Object[]} data.changes - Individual routing notifications
         * @param {Object[]} data.changes[].result.ringsDetails - Individual rings
         */
        this.acceptWaitingConversations = function (data) {
            data.changes.forEach(change => {
                if (change.type === 'UPSERT') {
                    change.result.ringsDetails.forEach(ring => {
                        if (ring.ringState === 'WAITING') {
                            this.updateRingState({
                                'ringId': ring.ringId,
                                'ringState': 'ACCEPTED'
                            }, (e, resp) => {
                                if (e) { log.error(`[bot.js] acceptWaitingConversations ${JSON.stringify(e)}`) }
                                else { log.info(`[bot.js] acceptWaitingConversations: Joined conversation ${JSON.stringify(change.result.conversationId)}, ${JSON.stringify(resp)}`) }
                            });
                        }
                    });
                }
            });
        };

        /**
         * Join conversation
         *
         * @param {String} conversationId
         * @param {String} role - Possible roles include 'MANAGER', 'ASSIGNED_AGENT', 'READER'
         * @param {Boolean} announce - Announce presence after joining?
         */
        this.joinConversation = function (conversationId, role, announce = true) {
            if (!/^(READER|MANAGER|ASSIGNED_AGENT)$/.test(role)) {return false}
            this.updateConversationField({
                'conversationId': conversationId,
                'conversationField': [{
                    'field': 'ParticipantsChange',
                    'type': 'ADD',
                    'role': role
                }]
            }, (e, resp) => {
                if (e) { log.error(`[bot.js] joinConversation ${JSON.stringify(e)}`) }
                else {
                    log.info(`[bot.js] acceptWaitingConversations: Joined conversation ${JSON.stringify(conversationId)}, ${JSON.stringify(resp)}`);
                    if (announce && role !== 'READER') {
                        this.publishEvent({
                            dialogId: conversationId,
                            event: {
                                type: 'ContentEvent',
                                contentType: 'text/plain',
                                message: role + ' joined'
                            }
                        });
                    }
                }
            });
        };

        /**
         * Send text
         *
         * @param {String} conversationId
         * @param {String} message
         */
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
                else { log.silly('[bot.js] sendText successful')}
            });
        };

        /**
         * Send rich content (structured content)
         *
         * @param {String} conversationId
         * @param {Object} card - Structured Content Card
         * @param {String} card.id - Card ID for reporting
         * @param {Object} card.content - JSON Object validated at https://livepersoninc.github.io/json-pollock/editor/
         */
        this.sendRichContent = function (conversationId, card) {
            log.silly(`[bot.js] sending structured content card ${card.id} to conversation ${conversationId}`);
            this.publishEvent({
                dialogId: conversationId,
                event: {
                    type: 'RichContentEvent',
                    content: card.content
                }
            }, null, [{type: 'ExternalId', id: card.id}], (e) => {
                if (e) { log.error(`[bot.js] sendRichContent card ${card.id} ${JSON.stringify(e)} ${JSON.stringify(card.content)}`) }
                else { log.silly('[bot.js] sendRichContent successful')}
            });
        };

        /**
         *  Mark message(s) as "read"
         *
         * @param {String} conversationId - Conversation whose messages are being marked as read
         * @param {Array.<Number>} sequenceArray - The sequence numbers of the messages to mark as read
         */
        this.markAsRead = function (conversationId, sequenceArray) {
            this.publishEvent({
                dialogId: conversationId,
                event: {type: 'AcceptStatusEvent', status: 'READ', sequenceList: sequenceArray}
            }, (e) => {
                if (e) { log.error(`[bot.js] markAsRead ${JSON.stringify(e)}`) }
                else { log.silly('[bot.js] markAsRead successful')}
            });
        };

        /**
         * Transfer conversation to a new skill
         *
         * @param {String} conversationId
         * @param {String} targetSkillId
         */
        this.transferConversation = (conversationId, targetSkillId) => {
            log.info(`[bot.js] transferring conversation ${conversationId} to skill ${targetSkillId}`);
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
                        skill: targetSkillId
                    }
                ]
            }, (e) => {
                if (e) { log.error(`[bot.js] transferConversation ${JSON.stringify(e)}`) }
                else { log.silly('[bot.js] transferConversation successful')}
            });
        };

        /**
         * Remove a participant from a conversation
         *
         * @param {String} conversationId
         * @param {String} role
         */
        this.removeParticipant = (conversationId, role) => {
            log.info(`[bot.js] leaving conversation ${conversationId}`);
            this.updateConversationField({
                conversationId: conversationId,
                conversationField: [
                    {
                        field: 'ParticipantsChange',
                        type: 'REMOVE',
                        role: role
                    }
                ]
            }, (e) => {
                if (e) { log.error(`[bot.js] leaveConversation ${JSON.stringify(e)}`) }
                else { log.silly('[bot.js] leaveConversation successful') }
            });
        };

        /**
         * Close conversation
         *
         * @param {String} conversationId
         */
        this.closeConversation = (conversationId) => {
            this.updateConversationField({
                'conversationId': conversationId,
                'conversationField': [
                    {
                        'field': 'ConversationStateField',
                        'conversationState': 'CLOSE'
                    }
                ]
            }, (e) => {
                if (e) { log.error(`[bot.js] closeConversation ${JSON.stringify(e)}`) }
                else { log.silly('[bot.js] closeConversation successful') }
            });
        };

        /**
         * Is a specific PID a participant in a specific conversation, and if so with what role?
         *
         * @param {Object} conversationDetails - A conversationDetails object from an ExConversationChangeNotification
         * @param {String} [pid=(bot_user_pid)]
         *
         * @returns {String} - A role name or 'undefined'
         */
        this.isPIDaParticipant = (conversationDetails, pid = this.agentId) => {
            let participant = conversationDetails.participants.filter(p => p.id === pid)[0];
            return participant && participant.role;
        };

        /**
         * Is this conversation in the "my conversations" list?
         *
         * @param {String} conversationId
         *
         * @returns {Boolean}
         */
        this.isInMyConversationsList = (conversationId) => {
            return !!this.myConversations[conversationId];
        };

        /**
         * Add this conversation to the "my conversations" list
         *
         * @param {String} conversationId
         */
        this.addToMyConversations = (conversationId) => {
            this.myConversations[conversationId] = {};
        };

        /**
         * Update this conversation's details in "my conversations" list
         *
         * @param {String} conversationId
         * @param {Object} result - the "result" attribute of an ExConversationChangeNotification
         */
        this.updateMyConversation = (conversationId, result) => {
            let _oldData = this.myConversations[conversationId] || {};
            let _newData = {
                convId: result.convId,
                conversationDetails: result.conversationDetails,
                consumerProfile: _oldData.consumerProfile
            };
            if (result.lastContentEventNotification) {
                _newData.lastContentEventNotification = {
                    sequence: result.lastContentEventNotification.sequence,
                    serverTimestamp: result.lastContentEventNotification.serverTimestamp,
                    originatorId: result.lastContentEventNotification.originatorId,
                    originatorPId: result.lastContentEventNotification.originatorPId,
                    originatorMetadata: { role: result.lastContentEventNotification.originatorMetadata.role },
                    event: { type: result.lastContentEventNotification.event.type }
                };
            }
            this.myConversations[conversationId] = _newData;
        };

        /**
         * Get the server clock and compare it to the client clock.
         * Also used to periodically ping the server for keep-alive.
         *
         * @param {Object} context
         * @private
         */
        function _getClock (context) {
            let before = new Date();
            context.getClock({}, (e, resp) => {
                if (e) {log.error(`[bot.js] getClock: ${JSON.stringify(e)}`)}
                else {
                    let after = new Date();
                    log.silly(`[bot.js] getClock: request took ${after.getTime()-before.getTime()}ms, diff = ${resp.currentTime - after}`);
                }
            });
        }
    }

    static get config() {
        let conf = {};
        if (!process.env.LP_ACCOUNT) { throw new Error('missing accountId param') }
        else { conf.accountId = process.env.LP_ACCOUNT }

        if (process.env.LP_TOKEN) {
            conf.token = process.env.LP_TOKEN;
        } else if (process.env.LP_PASSWORD) {
            conf.username = process.env.LP_USER;
            conf.password = process.env.LP_PASSWORD;
        } else if (process.env.LP_ASSERTION) {
            conf.userId = process.env.LP_USERID;
            conf.assertion = process.env.LP_ASSERTION;
        } else if (process.env.LP_APPKEY) {
            conf.username = process.env.LP_USER;
            conf.appKey = process.env.LP_APPKEY;
            conf.secret = process.env.LP_SECRET;
            conf.accessToken = process.env.LP_ACCESSTOKEN;
            conf.accessTokenSecret = process.env.LP_ACCESSTOKENSECRET;
        } else {
            throw new Error('missing token or user/password or assertion or appKey/secret/accessToken/accessTokenSecret params');
        }

        return conf;
    }
}

module.exports = Bot;
