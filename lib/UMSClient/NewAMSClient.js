window.lpTag = window.lpTag || {};
lpTag.AMSClient = lpTag.AMSClient || function (configuration) {
        //TODO: add logs

        var name = "AMSClient",
            version = "2.0.0",
            apiVersion = 2,
            MAX_MESSAGES = 200,
            socketConnected = false,
            pendingServerRequests = [],
            resendTimedOutRequests = false,
            pendingMessages = {},
            instanceData = {},
            errorTimeoutId,
            requestTimeout = 10000, //10 sec
            errorCheckInterval = 1000,
            amsTransport,
            timeoutError = {timeout: "Request has timed out"},
            statics = lpTag.AMSStatics,
            utils = lpTag.AMSUtils(),
            events = new lpTag.Chronos.Events(),
            allConversationStates = utils.getValues(statics.conversation.states);

        /*************** Invocation ************************/

        init(configuration);

        /*************** Public Methods ************************/

        function init(configuration) {
            if (configuration) {
                apiVersion = configuration.apiVersion || apiVersion;
                instanceData.memberType = configuration.memberType || statics.memberTypes.USER;
                resendTimedOutRequests = configuration.resendTimedOutRequests === true;
                _bindListeners(configuration);
                if (configuration.domain) {
                    amsTransport = new lpTag.AMSTransport({
                        ping: {
                            request: _buildRequest(statics.requests.GET_CLOCK),
                            keys: {
                                request: "id",
                                response: "reqId"
                            },
                            timeout: configuration.pingTimeout || 10000,
                            idleBeforePing: configuration.pingInterval || 10000,
                            callback: _pingCallback
                        },
                        storageConf: configuration.storageConf,
                        message: handleMessage,
                        closed: _handleSocketClosed,
                        created: _handleSocketCreated,
                        domain: configuration.domain,
                        IDPDomain: configuration.IDPDomain,
                        authCode: configuration.authCode,
                        hasAuthentication: configuration.hasAuthentication,
                        token: configuration.token,
                        memberType: instanceData.memberType,
                        apiVersion: apiVersion,
                        accountId: configuration.accountId,
                        noWS: configuration.noWS,
                        onAuthenticationError: _handleAuthenticationError
                    });
                } else {
                    utils.error("No domain on initialization", name);
                }
            }
        }

        function reInit(configuration) {

            if (amsTransport && amsTransport.closeConnection) {
                amsTransport.closeConnection();
            }

            events.unregister({appName: name});

            init(configuration);
        }

        /**
         * requests the server current time.
         */
        function getClock() {
            var msg = _buildRequest(statics.requests.GET_CLOCK);
            return _queueForResponseAndSend(msg);
        }

        /**
         * Handles all incoming messages
         * @param msg
         */
        function handleMessage(msg) {
            switch (msg.kind) {
                case statics.KINDS.NOTIFICATION:
                    _handleNotification(msg);
                    break;
                case statics.KINDS.RESPONSE:
                    _handleResponse(msg);
                    break;
            }
        }

        /**
         * Sends a message in the conversation
         * @param msgObj
         *  conversationId
         *  text - the string message
         */
        function sendMessage(msgObj) {
            if (utils.validateConditions({
                        conversationId: {type: utils.validationTypes.STRING}
                    },
                    msgObj)) {
                var msg = _buildRequest(statics.requests.PUBLISH_EVENT, {
                    dialogId: msgObj.conversationId,
                    event: {
                        type: statics.eventTypes.CONTENT,
                        contentType: msgObj.contentType || "text/plain",
                        message: msgObj.text
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        function imageMessage(msgObj) {
            if (utils.validateConditions({
                        conversationId: {type: utils.validationTypes.STRING}
                    },
                    msgObj)) {
                var msg = _buildRequest( ".ams.ms.GenerateURLForDownloadFile", {
                    dialogId: msgObj.conversationId,
                    relativePath:msgObj.pathUrl
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Updates the chat state within the dialog
         * @param msgObj
         *  conversationId
         *  dialogState - string from the enum dialogStates
         */
        function setDialogState(msgObj) {
            if (utils.validateConditions({
                    dialogId: {type: utils.validationTypes.STRING},
                    dialogState: {type: utils.validationTypes.ENUM, expected: statics.dialogStates}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.PUBLISH_EVENT, {
                    dialogId: msgObj.dialogId,
                    event: {
                        type: statics.eventTypes.CHAT_STATE,
                        chatState: msgObj.dialogState.toUpperCase()
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * sets the conversation state
         *
         * @param msgObj
         * @param msgObj.conversationId the conversation id.
         * @param msgObj.conversationState the new state for the conversation. use values from the
         * CONVERSATION_STATES enum.
         */
        function setConversationState(msgObj) {
            if (utils.validateConditions({
                    conversationId: {type: utils.validationTypes.STRING},
                    conversationState: {type: utils.validationTypes.ENUM, expected: statics.conversation.states}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, {
                    conversationId: msgObj.conversationId,
                    conversationField: {
                        field: statics.conversationFields.CONVERSATION_STATE,
                        conversationState: msgObj.conversationState || statics.conversation.states.CLOSE
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * close conversation
         *
         *  @deprecated use setConversationState instead
         *
         * @param msgObj
         *  conversationId
         */
        function closeConversation(msgObj) {
            msgObj.conversationState = statics.conversation.states.CLOSE;
            setConversationState(msgObj);
        }

        /**
         * changes the conversation participants
         *
         * @param msgObj
         * @param msgObj.conversationId the conversation id.
         * @param msgObj.userId the user id of the participant to change.
         * @param msgObj.role the participant role.
         * @param msgObj.changeType the nature of the change, e.g. add, remove. use values from the
         * statics.conversationFields.PARTICIPANTS_CHANGE enum.
         */
        function changeConversationParticipant(msgObj) {
            if (utils.validateConditions({
                    conversationId: {type: utils.validationTypes.STRING},
                    userId: {type: utils.validationTypes.STRING},
                    role: {type: utils.validationTypes.ENUM, expected: statics.participant.roles},
                    changeType: {type: utils.validationTypes.ENUM, expected: statics.fieldsChangeTypes}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, {
                    conversationId: msgObj.conversationId,
                    conversationField: {
                        field: statics.conversationFields.PARTICIPANTS_CHANGE,
                        type: msgObj.changeType,
                        userId: msgObj.userId,
                        role: msgObj.role
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Request a Transfer of the conversation to a skill queue.
         * @param reqObj
         */
        function transferConversationBySkill(msgObj) {
            if (utils.validateConditions({
                    ownerId: {type: utils.validationTypes.STRING},
                    conversationId: {type: utils.validationTypes.STRING},
                    skillId: {type: utils.validationTypes.STRING}
                }, msgObj)) {

                // custom validation for the skill transfer:
                var msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, {
                    conversationId: msgObj.conversationId,
                    conversationField: [
                        {
                            field: statics.conversationFields.PARTICIPANTS_CHANGE,
                            type: statics.fieldsChangeTypes.REMOVE,
                            userId: msgObj.ownerId || "",
                            role: statics.participant.roles.ASSIGNED_AGENT
                        },
                        {
                            field: statics.conversationFields.SKILL,
                            type: statics.fieldsChangeTypes.UPDATE,
                            skill: msgObj.skillId
                        }]
                });

                return _queueForResponseAndSend(msg, msgObj);

            }
        }


        /**
         * an alias for removeAgentConversationParticipant
         *
         * @deprecated use changeConversationParticipant instead
         *
         * @param msgObj
         * @returns {*}
         */
        function unassignConversation(msgObj) {
            msgObj.role = statics.participant.roles.ASSIGNED_AGENT;
            msgObj.changeType = statics.fieldsChangeTypes.REMOVE;
            return changeConversationParticipant(msgObj);
        }

        /**
         * Request the user profile
         * @param msgObj
         *  userId
         */
        function getUserProfile(msgObj) {
            if (utils.validateConditions({
                    userId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var body = {};
                if (msgObj && msgObj.userId) {
                    body.userId = msgObj.userId;
                }
                var msg = _buildRequest(statics.requests.GET_USER_PROFILE, body);
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Request my user profile
         * @param msgObj
         *  userId
         */
        function getMyUserProfile(msgObj) {
            var msg = _buildRequest(statics.requests.GET_USER_PROFILE);
            return _queueForResponseAndSend(msg, msgObj);
        }

        /**
         * Set a new status to the agent
         * @param msgObj
         */
        function setAgentStatus(msgObj) {

            if (utils.validateConditions({
                    agentUserId: {type: utils.validationTypes.STRING},
                    availability: {type: utils.validationTypes.STRING}
                }, msgObj)) {

                var type = statics.requests.SET_AGENT_STATUS;
                var body = {
                    channels: ["MESSAGING"]
                };

                //Get the agent user ID
                body.agentUserId = msgObj.agentUserId;

                //Set the new availability
                body.availability = msgObj.availability;

                var msg = _buildRequest(type, body);
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Subscribe to changes in the AMS agent status
         * @param msgObj
         */
        function subscribeAgentStatusUpdates(msgObj) {
            if (utils.validateConditions({
                    brandId: {type: utils.validationTypes.STRING},
                    agentId: {type: utils.validationTypes.STRING}
                }, msgObj)) {

                var type = statics.requests.SUBSCRIBE_AGENT_STATUS;
                var body = {};
                body.brandId = msgObj.brandId;
                body.agentId = msgObj.agentId;

                //Empty availability registers to all statuses
                body.agentAvailability = "";

                var msg = _buildRequest(type, body);
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Saves the user profile for the logged on user
         * @param msgObj
         */
        function setUserProfile(msgObj) {
            if (utils.validateConditions({
                    firstName: {type: utils.validationTypes.STRING},
                    lastName: {type: utils.validationTypes.STRING},
                    userId: {type: utils.validationTypes.STRING},
                    avatarUrl: {type: utils.validationTypes.STRING},
                    email: {type: utils.validationTypes.STRING},
                    phone: {type: utils.validationTypes.NUMBER},
                    apns: {type: utils.validationTypes.STRING},
                    certName: {type: utils.validationTypes.STRING},
                    token: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.SET_USER_PROFILE, {
                    firstName: msgObj.firstName,
                    lastName: msgObj.lastName,
                    userId: msgObj.userId,
                    authenticatedData: msgObj.authenticatedData,
                    avatarUrl: msgObj.avatarUrl,
                    role: msgObj.role || statics.participant.roles.ASSIGNED_AGENT,
                    backgndImgUri: msgObj.backgndImgUri,
                    description: msgObj.description,
                    privateData: {
                        mobileNum: msgObj.phone,
                        mail: msgObj.email,
                        pushNotificationData: {
                            serviceName: msgObj.apns,
                            certName: msgObj.certName,
                            token: msgObj.token
                        }
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Asks the server to create a new conversation
         * @param msgObj
         *  brandId - the id of the site for the conversation
         */
        function createConversation(msgObj) {
            var type;
            msgObj = msgObj || {};
            var body = {
                context: null,
                skillId: msgObj.skillId || "-1",
                channelType: msgObj.channelType || statics.channelTypes.MESSAGING,
                ttrDefName: null
            };
            switch (instanceData.memberType) {
                case statics.memberTypes.USER:
                    if (utils.validateConditions({brandId: {type: utils.validationTypes.STRING}}, msgObj)) {
                        type = statics.requests.REQUEST_CONVERSATION_CONSUMER;
                        body.brandId = msgObj.brandId;
                        body.skillId = msgObj.skillId || "-1";
                        body.channelType = msgObj.channelType;
                        body.conversationContext = {
                            visitorId: msgObj.conversationContext.visitorId,
                            sessionId:  msgObj.conversationContext.sessionId,
                            interactionContextId: msgObj.conversationContext.interactionContextId,
                            type: msgObj.conversationContext.type
                        };
                        body.campaignInfo = {
                            campaignId: msgObj.campaignInfo.campaignId,
                            engagementId: msgObj.campaignInfo.engagementId
                        };
                    }
                    break;
                case statics.memberTypes.AGENT:
                    if (utils.validateConditions({consumerId: {type: utils.validationTypes.STRING}}, msgObj)) {
                        type = statics.requests.REQUEST_CONVERSATION_AGENT;
                        body.consumerId = msgObj.consumerId;
                        body.conversationContext = {
                            type: "ProactiveContext",
                            originConversationId: msgObj.conversationId,
                            originConversationContext: msgObj.originContext
                        };
                    }
                    break;
            }
            if (type) {
                var msg = _buildRequest(type, body);
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Subscribes to routing notifications (rings).
         * @param msgObj - the message object to create the request.
         * @param msgObj.brandId - The brand ID. Required.
         * @param msgObj.agentId - The agent ID. Required. (also, only an agent can request this).
         * @param [msgObj.skillId] - The skill ID. Optional (for additional filtering).
         * @param [msgObj.conversationId] - The conversation ID. Optional (for additional filtering).
         * @returns {*}
         */
        function subscribeToRouting(msgObj) {
            if (utils.validateConditions({
                    brandId: {type: utils.validationTypes.STRING},
                    agentId: {type: utils.validationTypes.STRING}
                }, msgObj) && utils.validateConditions({
                    memberType: {
                        type: utils.validationTypes.CUSTOM,
                        expected: statics.memberTypes.AGENT
                    }
                }, instanceData)) {
                var msg = _buildRequest(statics.requests.SUBSCRIBE_ROUTING_TASKS, {
                    brandId: msgObj.brandId,
                    agentId: msgObj.agentId,
                    channelType: statics.channelTypes.MESSAGING
                });
                if (msgObj.skillId) {
                    msg.body.skillId = msgObj.skillId;
                }
                if (msgObj.conversationId) {
                    msg.body.conversationId = msgObj.conversationId;
                }
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Updates a subscription to routing notifications (rings).
         * @param msgObj - the message object to create the request.
         * @param msgObj.subscriptionId - The subscription ID. Required.
         * @param msgObj.brandId - The brand ID. Required.
         * @param msgObj.agentId - The agent ID. Required. (also, only an agent can request this).
         * @param [msgObj.skillId] - The skill ID. Optional (for additional filtering).
         * @param [msgObj.conversationId] - The conversation ID. Optional (for additional filtering).
         * @param [msgObj.channelType] - The channel Type. Optional. Default is "MESSAGING".
         * @returns {*}
         */
        function updateRoutingSubscription(msgObj) {
            if (utils.validateConditions({
                    subscriptionId: {type: utils.validationTypes.STRING},
                    brandId: {type: utils.validationTypes.STRING},
                    agentId: {type: utils.validationTypes.STRING}
                }, msgObj) && utils.validateConditions({
                    memberType: {
                        type: utils.validationTypes.CUSTOM,
                        expected: statics.memberTypes.AGENT
                    }
                }, instanceData)) {
                var msg = _buildRequest(statics.requests.UPDATE_ROUTING_SUBSCRIPTION, {
                    subscriptionId: msgObj.brandId,
                    brandId: msgObj.brandId,
                    agentId: msgObj.agentId
                });
                if (msgObj.skillId) {
                    msg.body.skillId = msgObj.skillId;
                }
                if (msgObj.conversationId) {
                    msg.body.conversationId = msgObj.conversationId;
                }
                if (msgObj.channelType) {
                    msg.body.channelType = msgObj.channelType;
                }
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Assign a conversation to an agent
         * @param msgObj
         *  conversationId - the id of the requested conversation
         */
        function takeConversation(msgObj) {
            if (utils.validateConditions({
                    ringId: {type: utils.validationTypes.STRING}
                }, msgObj) && utils.validateConditions({
                    memberType: {
                        type: utils.validationTypes.CUSTOM,
                        expected: statics.memberTypes.AGENT
                    }
                }, instanceData)) {
                var msg = _buildRequest(statics.requests.UPDATE_RING_STATE, {
                    ringId: msgObj.ringId,
                    ringState: 'ACCEPTED'
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Querys the messages of a specific conversation
         * @param msgObj
         *  conversationId
         *  maxQuantity - the number of messages
         *  olderThanSequence - the sequence end index ,if  olderThanSequence has no value we  get the newest chat lines
         */
        function queryMessages(msgObj) {
            if (utils.validateConditions({
                    conversationId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var maxQuantity = msgObj.maxQuantity || MAX_MESSAGES;
                var olderThan = msgObj.lastId || maxQuantity;
                var newerThan = olderThan - maxQuantity;
                if (newerThan < 0) {
                    newerThan = 0;
                }
                return _queryMessages(msgObj, {
                    maxQuantity: maxQuantity,
                    olderThan: olderThan,
                    newerThan: newerThan
                });
            }
        }

        /**
         * Querys the messages of a specific conversation
         * @param msgObj
         *  conversationId
         *  maxQuantity - the number of messages
         *  newerThanSequence - the sequence start index ,if  newerThanSequence has no value we  get the newest chat lines
         */
        function queryMessagesNewerThan(msgObj) {
            if (utils.validateConditions({
                    conversationId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var maxQuantity = msgObj.maxQuantity || MAX_MESSAGES;
                var newerThan = msgObj.lastId || 0;
                var olderThan = newerThan + maxQuantity;
                return _queryMessages(msgObj, {
                    maxQuantity: maxQuantity,
                    olderThan: olderThan,
                    newerThan: newerThan
                });
            }
        }

        /**
         * Sets the message state
         * @param msgObj
         *  sequenceList - the Array of sequence Ids
         *  state - a state from the messageState enum
         *  conversationId
         */
        function markMessagesState(msgObj) {
            if (utils.validateConditions({
                    conversationId: {type: utils.validationTypes.STRING},
                    state: {type: utils.validationTypes.ENUM, expected: statics.messageState}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.PUBLISH_EVENT, {
                    dialogId: msgObj.conversationId,
                    event: {
                        type: statics.eventTypes.ACCEPT_STATUS,
                        status: msgObj.state.toUpperCase(),
                        sequenceList: ( msgObj.sequenceList && msgObj.sequenceList.constructor === Array ? msgObj.sequenceList : [msgObj.sequenceList])
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Gets the brand profile
         * @param msgObj
         *  brandId - brandId for retrieving the profile
         */
        function getBrandProfile(msgObj) {
            if (utils.validateConditions({
                    brandId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.GET_BRAND_PROFILE, {
                    brandId: msgObj.brandId
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Sets the brand profile
         * @param msgObj
         *  brandId - brandId for setting the profile
         *  name - brand name
         *  description - brand description
         *  category - "Chat"
         *  dateJoined - timestamp for date brand joined
         *  lastUpdated - timestamp for date brand last updated
         *  logoImg - uri for the brand image
         *  backgroundImg - uri for the brand background image
         *  ttrCustom - time in millis of custom TTR
         *  ttrUrgent - time in millis of urgent TTR
         *  ttrNormal - time in millis of normal TTR
         *  delayType - "NIGHT/WEEKEND/HOLIDAY/CUSTOM"
         *  tillWhen - timestamp for date of when the account off-hours will expire
         */
        function setBrandProfile(msgObj) {
            if (utils.validateConditions({
                    brandId: {type: utils.validationTypes.STRING},
                    name: {type: utils.validationTypes.STRING},
                    description: {type: utils.validationTypes.STRING},
                    category: {type: utils.validationTypes.STRING},
                    dateJoined: {type: utils.validationTypes.NUMBER},
                    lastUpdated: {type: utils.validationTypes.NUMBER},
                    logoImg: {type: utils.validationTypes.STRING},
                    backgroundImg: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.SET_BRAND_PROFILE);
                utils.overRideMerge(msg.body, msgObj);
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Gets the brands
         * @param msgObj
         *  brandId - brandId for retrieving the profile
         */
        function getBrands(msgObj) {
            if (utils.validateConditions({
                    memberType: {
                        type: utils.validationTypes.CUSTOM,
                        expected: statics.memberTypes.USER
                    }
                }, instanceData)) {
                var msg = _buildRequest(statics.requests.GET_BRANDS, {
                    fromTimestamp: msgObj.fromTimestamp
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Subscribes to conversations and gets notified on the conversations conversations with extra information
         * @param msgObj
         */
        function subscribeConversations(msgObj) {
            if (utils.validateConditions({
                    brandId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.SUBSCRIBE_CONVERSATIONS, {
                    brandId: msgObj.brandId,
                    minLastUpdatedTime: msgObj.minLastUpdatedTime,
                    agentIds: msgObj.agentIds,
                    consumerId: msgObj.consumerId,
                    convState: msgObj.convState || allConversationStates
                });
                if (msgObj.maxLastUpdatedTime) {
                    msg.maxLastUpdatedTime = msgObj.maxLastUpdatedTime;
                }
                if (msgObj.maxETTR) {
                    msg.maxETTR = msgObj.maxETTR;
                }
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Unsubscribe from a subscription to conversations
         * @param msgObj
         */
        function unsubscribeConversations(msgObj) {
            if (utils.validateConditions({
                    subscriptionId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.UNSUBSCRIBE_CONVERSATIONS, {
                    subscriptionId: msgObj.subscriptionId
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Updates subscription to conversations and gets notified on the conversations with extra information
         * @param msgObj
         */
        function updateConversationsSubscription(msgObj) {
            if (utils.validateConditions({
                    brandId: {type: utils.validationTypes.STRING},
                    subscriptionId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.SUBSCRIBE_CONVERSATIONS, {
                    brandId: msgObj.brandId,
                    maxLastUpdatedTime: msgObj.maxLastUpdatedTime,
                    minLastUpdatedTime: msgObj.minLastUpdatedTime,
                    agentIds: msgObj.agentIds,
                    consumerId: msgObj.consumerId,
                    maxETTR: msgObj.maxETTR,
                    convState: msgObj.convState || allConversationStates,
                    subscriptionId: msgObj.subscriptionId
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Sets the CSAT rate for a conversation
         * @param msgObj
         */
        function setCSAT(msgObj) {
            var msgBody,
                msg;

            if (utils.validateConditions({
                    conversationId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                msgBody = {
                    conversationId: msgObj.conversationId,
                    conversationField: msgObj.CSAT
                };
                msgBody.conversationField.field = statics.conversationFields.CSAT_RATE;

                msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, msgBody);

                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Sets the delay for a conversation
         * @param msgObj
         */
        function setDelay(msgObj) {
            if (utils.validateConditions({
                    conversationId: {type: utils.validationTypes.STRING},
                    delayType: {type: utils.validationTypes.ENUM, expected: statics.delayTypes},
                    tillWhen: {type: utils.validationTypes.NUMBER}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, {
                    conversationId: msgObj.conversationId,
                    conversationField: {
                        field: statics.conversationFields.DELAY,
                        type: msgObj.delayType,
                        tillWhen: msgObj.tillWhen
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Sets the manual Effective TTR for a conversation
         * @param msgObj
         */
        function setETTR(msgObj) {
            if (utils.validateConditions({
                    conversationId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, {
                    conversationId: msgObj.conversationId,
                    conversationField: {
                        field: statics.conversationFields.MANUAL_ETTR,
                        time: msgObj.time || null
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Sets the TTR for a conversation
         * @param msgObj
         */
        function setTTR(msgObj) {
            if (utils.validateConditions({
                    conversationId: {type: utils.validationTypes.STRING},
                    ttrType: {type: utils.validationTypes.ENUM, expected: statics.effectiveTTRTypes},
                    value: {type: utils.validationTypes.NUMBER, optional: true}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, {
                    conversationId: msgObj.conversationId,
                    conversationField: {
                        field: statics.conversationFields.TTR,
                        ttrType: msgObj.ttrType,
                        value: msgObj.value || 0
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Sets the note for a conversation
         * @param msgObj
         */
        function setNote(msgObj) {
            if (utils.validateConditions({
                    note: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, {
                    conversationId: msgObj.conversationId,
                    conversationField: {
                        field: statics.conversationFields.NOTE,
                        note: msgObj.note
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * Sets a topic for a conversation
         * @param msgObj
         */
        function setTopic(msgObj) {
            if (utils.validateConditions({
                    topic: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, {
                    conversationId: msgObj.conversationId,
                    conversationField: {
                        field: statics.conversationFields.TOPIC,
                        note: msgObj.topic
                    }
                });
                return _queueForResponseAndSend(msg, msgObj);
            }
        }

          /**
         * Open a new conversation dialog
         * @param msgObj
         */
        function openDialog(msgObj) {
            _modifyDialog(msgObj, statics.dialogActions.CREATE);
        }

       /**
         * Update an existing conversation dialog.
         * In case you want to close a dialog you can update the state of the dialogDetails
         * @param msgObj
         */
        function updateDialog(msgObj) {
            _modifyDialog(msgObj,statics.dialogActions.UPDATE);
        }

        function _modifyDialog(msgObj, method) {
            if (utils.validateConditions(
                {
                    conversationId: {type: utils.validationTypes.STRING},
                    dialogId: {type: utils.validationTypes.STRING}
                }, msgObj)) {
                var msg = _buildRequest(statics.requests.UPDATE_CONVERSATION, {
                    conversationId: msgObj.conversationId,
                    conversationField: {
                        field : statics.conversationFields.DIALOG_CHANGE,
                        type : method || statics.dialogActions.CREATE,
                        dialogId : msgObj.dialogId,
                        dialog : msgObj.dialog
                    }
                });
                _queueForResponseAndSend(msg, msgObj);
            }
        }

        /**
         * get the server time diff
         * @returns {{}|number|*}
         */
        function getTimeDiff() {
            return instanceData && instanceData.serverTimeDiff;
        }

        /**
         * Cleans up memory from the component
         */
        function dispose() {
            if (amsTransport && amsTransport.closeConnection) {
                amsTransport.closeConnection();
            }
            events.unregister({appName: name});

            events = null;
        }

        /******************** Private Methods *******************/

        function _checkForErrors() {
            clearTimeout(errorTimeoutId);
            var now = new Date();
            var pendReqCount = 0;
            var timedOutCallbacks = [];
            for (var key in pendingMessages) {//Check for requests taking too long
                if (pendingMessages.hasOwnProperty(key) && pendingMessages[key].launchTime) {
                    var timeElapsed = now - pendingMessages[key].launchTime;
                    if (timeElapsed > pendingMessages[key].timeout) {//Queue error callback
                        timedOutCallbacks.push(key);
                    } else {
                        pendReqCount++;
                    }
                }
            }
            if (timedOutCallbacks.length) {
                utils.error("Checking errors found " + timedOutCallbacks.length + " timeout callbacks to call", name);
                for (var i = 0; i < timedOutCallbacks.length; i++) {//Execute the callbacks
                    _notifyOutCome(timedOutCallbacks[i], timeoutError, true);
                }
            }
            if (pendReqCount > 0) {
                errorTimeoutId = setTimeout(_checkForErrors, errorCheckInterval);
            }
            return true;
        }

        /**
         * Triggers so we know if the service is none responsive for some reason
         * @param data
         * @private
         */
        function _pingCallback(data){
            if(data && data.state === "PING_SUCCESS"){
                _triggerEvent(statics.events.PING_SUCCESS, data || {});
            }else{
                _triggerEvent(statics.events.SERVICE_ISSUE, data || { connected: false, ts: new Date().getTime()});
            }

        }

        function _queryMessages(msgObj, options) {
            var request = _buildRequest(statics.requests.QUERY_MESSAGES, {
                dialogId: msgObj.conversationId,
                maxQuantity: options.maxQuantity,
                olderThanSequence: options.olderThan,
                newerThanSequence: options.newerThan
            });
            return _queueForResponseAndSend(request, msgObj);
        }

        /**
         * Handles a notification (not a response to a request)
         * @param msg
         * @private
         */
        function _handleNotification(msg) {
            var name = statics.notifications[msg && msg.type];
            if (name) {
                _triggerEvent(name, msg.body);
            }
          _triggerEvent(statics.events.MSG_RECEIVE, {});
        }

        /**
         * Handles a response to a request
         * @param msg
         * @private
         */
        function _handleResponse(msg) {
            var name = null;
            switch (msg.type) {
                case statics.responses.GET_CLOCK:
                    _handleClock(msg.body);
                    break;
                case statics.responses.GET_USER_PROFILE:
                    _handleUserProfile(msg.body);
                    break;
                default:
                    name = statics.responses[msg.type];
                    break;
            }
            if (name) {
                _triggerEvent(name, msg.body, msg.reqId);
            }
            _handleOutcome(msg);
            _triggerEvent(statics.events.MSG_RECEIVE, {});
        }

        /**
         * Thin wrapper
         * @param msg
         * @private
         */
        function _handleOutcome(msg) {
            if (typeof msg.code !== "undefined" && msg.code > 399) {
                _notifyOutCome(msg.reqId, msg.body, true); //reqId is the id associated with the request that is returned from the server - DO NOT TOUCH!!!
            } else {
                _notifyOutCome(msg.reqId, msg.body, false); //reqId is the id associated with the request that is returned from the server - DO NOT TOUCH!!!
            }
        }

        function _bindListeners(configuration) {
            var listener, listenersBind;
            for (var key in configuration) {
                if (configuration.hasOwnProperty(key) &&
                    key.indexOf("on") === 0) {
                    listener = configuration[key];
                    listenersBind = listener.constructor === Array ? listener : [listener];
                    for (var i = 0; i < listenersBind.length; i++) {
                        _bindToEvent(key, listenersBind[i].func || listenersBind[i], listenersBind[i].context, name);
                    }
                }
            }
        }

        function _bindToEvent(eventName, callBack, context, appName) {
            var eventInfo = {
                eventName: eventName,
                appName: appName || "",
                aSync: false,
                func: callBack,
                context: (context || null)
            };
            return events.register(eventInfo);
        }

        /**
         * Triggers an event
         * @param eventName
         * @param data
         * @private
         */
        function _triggerEvent(eventName, data, requestId) {
            if (requestId && typeof data === "object") {
                data.requestId = requestId;
            }

            events.trigger({
                eventName: eventName,
                appName: name,
                data: data,
                passDataByRef: false
            });
        }

        /**
         * Stores a callback method for specific protocol messages
         * @param id
         * @param options
         * @private
         */
        function _queueForResponse(id, options) {
            if (id && options && (options.success || options.error)) {
                pendingMessages[id] = {
                    error: options.error,
                    success: options.success,
                    context: options.context,
                    launchTime: new Date(),
                    timeout: options.timeout || requestTimeout
                };
                errorTimeoutId = setTimeout(_checkForErrors, errorCheckInterval);
            }
        }

        /**
         * Publishes outcomes for registered messages
         * @param id
         * @param data
         * @param error
         * @private
         */
        function _notifyOutCome(id, data, error) {
            if (pendingMessages[id]) {
                utils.runCallBack(error ? pendingMessages[id].error : pendingMessages[id].success, data, pendingMessages[id].context);
                _dequeMessage(id);
            }
        }

        /**
         * Triggered for socket connected
         * @param data
         * @private
         */
        function _handleSocketCreated(data) {
            socketConnected = true;
            getClock();
            _triggerEvent(statics.events.CONNECTED, data || {connected: true, ts: new Date().getTime()});
            _sendPendingRequests();
        }

        /**
         * Triggered when the socket is closed
         * @param data
         * @private
         */
        function _handleSocketClosed(data) {
            socketConnected = false;
            _notifySocketClosedFailure();

            if (data && data.tokenIsInvalid) {
                _triggerEvent(statics.events.SESSION_INVALIDATED, {userId: instanceData.userId || null});
            }

            _triggerEvent(statics.events.CLOSED, data || {connected: false, ts: new Date().getTime()});
        }

        /**
         * Thwart all pending requests
         * @private
         */
        function _notifySocketClosedFailure() {
            for (var key in pendingMessages) {
                if (pendingMessages.hasOwnProperty(key)) {
                    _notifyOutCome(key, timeoutError, true);
                }
            }
        }

        function _handleAuthenticationError(data) {
            _triggerEvent(statics.events.AUTHENTICATION_ERROR, data);
        }

        /**
         * retrieve and stores the time diff between the server and the application local time
         * @param msg
         * @private
         */
        function _handleClock(msg) {
            if (msg && msg.currentTime) {
                instanceData.serverTimeDiff = new Date().getTime() - msg.currentTime;
            }
        }

        /**
         * Gets the user known data - sample may be out of date
         * messageSample = {
         *   "msgId":0,
         *   "msgType":"get_profile_response",
         *   "payload":{
         *      firstName":"elad",
         *      "lastName":"wertz",
         *      "avatarUrl":"http://www.avatar.com",
         *      "userId":"b7da2afd-2af0-4893-bc84-b4657839c4bc",
         *      "private":{
         *        "mail":"wee@gmail.com",
         *        "mobile_num":"0546662622",
         *        "push_notification_data":{
         *              "msgSubType":"profile",
         *         }
         *      },
         *      "description": "Awesome participant"
         * };
         * @param msg
         * @private
         */
        function _handleUserProfile(msg) {
            var filteredResult = utils.remodel(msg, {
                userId: "userId",
                firstName: "firstName",
                lastName: "lastName",
                authenticatedData: "authenticatedData",
                imgUrl: "avatarUrl",
                role: "role",
                backgroundImage: "backgndImgUri",
                phone: "privateData.mobileNum",
                mail: "privateData.mail",
                description: "description"
            });
            _triggerEvent(statics.events.USER_INFO, filteredResult);
        }

        /**
         * Removes a message from the queue
         * @param id
         * @private
         */
        function _dequeMessage(id) {
            for (var key in pendingMessages[id]) {
                if (pendingMessages[id].hasOwnProperty(key)) {
                    pendingMessages[id][key] = null;
                    delete pendingMessages[id][key];
                }
            }
            pendingMessages[id] = null;
            delete pendingMessages[id];
        }

        /*************** Utility functions *****************/

        /**
         * Queues for response, and sends the request to the socket API
         * @param request The request to send, including an ID
         * @param [options] Includes success/error callbacks & context
         * @private
         */
        function _queueForResponseAndSend(request, options) {
            if (request) {
                options = options || {};
                if(resendTimedOutRequests && !options.errorHasWrapper) {
                    options.errorHasWrapper = true;
                    options.error = _wrapError(request, options);
                }

                if(!socketConnected && resendTimedOutRequests) {
                    pendingServerRequests.push({request: request, options: options});
                } else {
                    _queueForResponse(request.id, options);
                    amsTransport.sendMessage(request);
                    return request.id;
                }
            }
        }

        /**
         * Builds a request according to the API V2 request structure
         * @param type The type request to send
         * @param [body] The body of the request. {} is the default body.
         * @returns {{kind: string, id: *, type: *, body: (*|{})}}
         * @private
         */
        function _buildRequest(type, body) {
            return {
                kind: statics.KINDS.REQUEST,
                id: utils.getUID(),
                type: type,
                body: body || {}
            };
        }

        /**
         * Send request that failed on socket issue
         * @private
         */
        function _sendPendingRequests() {
            var requestData;
            while (pendingServerRequests.length > 0 && socketConnected) {
                requestData = pendingServerRequests.shift();
                _queueForResponseAndSend(requestData.request, requestData.options);
            }
        }

        /**
         * Wrap error with retry in case of request timed out.
         * @param requestObj
         * @param callback
         * @returns {Function}
         * @private
         */
        function _wrapError(request, options) {
            var error = options.error;
            return function (data) {
                options.failure = isNaN(options.failure) ? 0 : options.failure;
                if(data.timeout && options.failure <=3) {
                    options.failure = options.failure ? options.failure + 1 : 1;
                    pendingServerRequests.push({request: request, options: options});
                } else {
                    utils.runCallBack(error, data);
                }
            };
        }

        /**
         * Wraps a public event binding function with a
         * predefined eventName
         * @param eventName
         * @returns {Function}
         * @private
         */
        function _bindEventWrapper(eventName) {
            return function (callback, context) {
                _bindToEvent(eventName, callback, context, name);
            };
        }

        /**************************** Instance API ****************************/

        this.name = name;
        this.v = version;
        this.apiVersion = apiVersion;
        this.init = init;
        this.reInit = reInit;
        this.getTimeDiff = getTimeDiff;
        this.dispose = dispose;
        this.getClock = getClock;
        this.handleMessage = handleMessage;
        this.sendMessage = sendMessage;
        this.imageMessage = imageMessage;
        this.setDialogState = setDialogState;
        this.setConversationState = setConversationState;
        this.closeConversation = closeConversation;
        this.changeConversationParticipant = changeConversationParticipant;
        this.unassignConversation = unassignConversation;
        this.setAgentStatus = setAgentStatus;
        this.subscribeAgentStatusUpdates = subscribeAgentStatusUpdates;
        this.getUserProfile = getUserProfile;
        this.getMyUserProfile = getMyUserProfile;
        this.setUserProfile = setUserProfile;
        this.createConversation = createConversation;
        this.takeConversation = takeConversation;
        this.subscribeToRouting = subscribeToRouting;
        this.updateRoutingSubscription = updateRoutingSubscription;
        this.queryMessages = queryMessages;
        this.queryMessagesNewerThan = queryMessagesNewerThan;
        this.markMessagesState = markMessagesState;
        this.getBrandProfile = getBrandProfile;
        this.setBrandProfile = setBrandProfile;
        this.getBrands = getBrands;
        this.updateConversationsSubscription = updateConversationsSubscription;
        this.subscribeConversations = subscribeConversations;
        this.unsubscribeConversations = unsubscribeConversations;
        this.setCSAT = setCSAT;
        this.setDelay = setDelay;
        this.setManualETTR = setETTR;
        this.restoreManualETTR = setETTR;
        this.setTTR = setTTR;
        this.setNote = setNote;
        this.setTopic = setTopic;
        this.transferConversationBySkill = transferConversationBySkill;
        this.openDialog = openDialog;
        this.updateDialog = updateDialog;

        for (var event in statics.events) {
            if (statics.events.hasOwnProperty(event)) {
                var eventName = statics.events[event];
                this[eventName] = _bindEventWrapper(eventName);
            }
        }
    };
