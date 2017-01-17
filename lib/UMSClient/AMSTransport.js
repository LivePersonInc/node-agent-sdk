/**
 * idleBeforePing: 60000,
 * pollingInterval: 500, //in millis
 * domain : domain,
 * token: token,
 * memberType: memberType,
 * apiVersion: 1/2
 * message: _wrapApiFunction(apiMethods.HANDLE_MESSAGE),
 * closed: _handleSocketClosed,
 * created: _handleSocketCreated,
 * ping: {
 *    request: _callApiFunction(apiMethods.GET_PING_REQUEST),
 *    response: " "
 * },
 * storageConf: {
 *  useSecureStorage: true/false,
 *  secureStorageLocation: "https://domain.com"
 *  lpNumber: "accountId",
 *  appName: "myApp"
 * }
 * @param config
 * @constructor
 */
window.lpTag = window.lpTag || {};
lpTag.AMSTransport = lpTag.AMSTransport || function (config) {

    var name = "AMSTransports",
        v = "0.0.2",
        utils = lpTag.AMSUtils(),
        postmessage = lpTag.taglets && lpTag.taglets.postmessage,
        poll = false,
        socketAPI,
        pollingTimeoutId,
        configuration,
        sessionDataManager,
        storageKey,
        memberTypes = {
            AGENT: "brand",
            VISITOR: "consumer"
        },
        defaults = {
            apiVersion: 2,
            memberType: memberTypes.VISITOR,
            pingInterval: 60000,
            autoReconnect: true,
            reconnectTimeout: 5000,
            maxReconnectAttempt: 100,
            pollingInterval: 2000
        },
        connectionDetails = {
            anonymousConsumerIDP: "https://{{IDPDomain}}/api/account/{{accountId}}/signup",
            authenticateConsumerIDP: "https://{{IDPDomain}}/api/account/{{accountId}}/authenticate",
            consumerTokenCreation: "https://{{domain}}/api/account/{{accountId}}/messaging/management/consumer/token", //This is the old one
            wsPath: "wss://{{domain}}/ws_api/account/{{accountId}}/messaging/{{memberType}}/{{token}}?v={{apiVersion}}",
            restPath: "https://{{domain}}/rest_api/account/{{accountId}}/messaging/{{memberType}}/{{token}}",
            postMessage: "https://{{domain}}/postmessage/postmessage.min.html", //For REST fallback
            postMessageIDP: "https://{{IDPDomain}}/postmessage/postmessage.min.html"//For token creation
        };

    if (config) {
        configure(config);
    }

    function configure(config) {
        configuration = config || {};
        configuration.pollingInterval = config.pollingInterval || defaults.pollingInterval;
        configuration.apiVersion = config.apiVersion || defaults.apiVersion;
        configuration.autoReconnect = config.autoReconnect || defaults.autoReconnect;
        configuration.reconnectTimeout = config.reconnectTimeout || defaults.reconnectTimeout;
        configuration.onAuthenticationError = config.onAuthenticationError;
        configuration.maxReconnectAttempt = config.maxReconnectAttempt || defaults.maxReconnectAttempt;
        configuration.pingInterval = config.pingInterval || defaults.pingInterval;
        configuration.memberType = (config.memberType && memberTypes[config.memberType]) || defaults.memberType;
        configuration.noWS = typeof config.noWS === 'boolean' ? config.noWS : false;
        storageKey = "lpMessaging-" + configuration.accountId;

        if (!configuration.token && configuration.memberType === memberTypes.VISITOR) {
            sessionDataManager = new window.lpTag.utils.SessionDataAsyncWrapper(configuration.storageConf || {});
            //Try to recover storage
            sessionDataManager.getSessionData(storageKey, _sessionDataCallback, _sessionDataCallback);
        } else {
            _initialize();
        }
    }

    function sendMessage(message) {
        if (!configuration.noWS && socketAPI && socketAPI.supported) {//Do websocket
            socketAPI.send(message);
        } else { //DO REST
            _sendRestMessage(message);
        }
    }

    function closeConnection() {
        if (!configuration.noWS && socketAPI && socketAPI.supported) {//Do websocket
            socketAPI.dispose();
        } else { //DO REST
            clearTimeout(pollingTimeoutId);
            _closeConnection();
        }
        if (sessionDataManager) {
            sessionDataManager.removeSessionData(storageKey);
        }
    }

    function _initialize() {
        if (!configuration.noWS) {
            socketAPI = new lpTag.taglets.LPWebSocketWrapper({
                ping: configuration.ping,
                idleBeforePing: configuration.pingInterval,
                server: utils.templateStrings(connectionDetails.wsPath, configuration),
                message: configuration.message,
                closed: _getClosedCallback(configuration.closed),
                created: configuration.created,
                autoReconnect: configuration.autoReconnect,
                reconnectTimeout: configuration.reconnectTimeout,
                maxReconnectAttempt: configuration.maxReconnectAttempt
            });
        }

        if (!socketAPI || !socketAPI.supported) {
            poll = true;
            _configureIFrames();
            _getMessages();
        }
    }

    function _configureIFrames(){
        var obj = {frames: [{
                    url: utils.templateStrings(connectionDetails.postMessage, configuration)
                }
        ]};
        if(config.IDPDomain){
            obj.frames.push({url: utils.templateStrings(connectionDetails.postMessageIDP, configuration)});
        }
        postmessage.configure(obj);
    }

    function _sessionDataCallback(authConf) {
        if (authConf && authConf.token && authConf.authCode === config.authCode) { //Found storage
            configuration.token = authConf.token;
            _initialize();
        } else {
            _createToken(_initialize);
        }
    }

    function _createToken(tokenCreated) {

        _configureIFrames();

        var authUrl = config.hasAuthentication ? connectionDetails.authenticateConsumerIDP : connectionDetails.anonymousConsumerIDP;
        var req = {
            url: configuration.IDPDomain ? utils.templateStrings(authUrl, configuration) : utils.templateStrings(connectionDetails.consumerTokenCreation, configuration),
            method: "POST",
            success: function (data) {
                if (data && data.body) {
                    configuration.token = data.body.token || data.body.jwt;
                }

                if (configuration.token) {
                    sessionDataManager.setSessionData(storageKey, {token: configuration.token, authCode: config.authCode});
                    utils.runCallBack(tokenCreated);
                } else {
                    utils.error("Error on _createToken: couldn't find token. data: " + JSON.stringify(data), name);
                    utils.runCallBack(config.onAuthenticationError, null, data);
                }
            },
            error: function (errData) {
                utils.error("Error on _createToken. data: " + JSON.stringify(errData), name);
                utils.runCallBack(config.onAuthenticationError, null, errData);
            }
        };

        if(config.authCode){//Did we get a third party authentication token? let's push it...
            req.data = {
                authCode: config.authCode
            };
        }
        postmessage.issueCall(req);
    }

    function _getClosedCallback(callback) {
        return function (data) {
            var tokenIsInvalid = data && (data.code === 1008 || data.code === 4407 || data.code === 4401),
                tokenIsInvalidInExplorer = data && data.code === 1005 && typeof data.reason === "string" && data.reason.indexOf("identity token is invalid") > -1; //temp fix for external window in explorer (socket.onClose callback is not getting the right data.code, which suppose to be 4407)

            if (tokenIsInvalid || tokenIsInvalidInExplorer) {
                data.tokenIsInvalid = true;
                closeConnection();
            }
            utils.runCallBack(callback, data);
        };
    }

    function _scheduleNextPoll(){
        if(pollingTimeoutId) {
            clearTimeout(pollingTimeoutId);
        }
        if(poll) {
            pollingTimeoutId = setTimeout(_getMessages, configuration.pollingInterval);
        }
    }

    /**Send message on session
     Send text:   used to send the various AMS requests

     POST
     Rel request url:
     rest_api/api/send
     query params:
     uuid - the one you received on Location header on Open API.
     Request Body:
     a valid AMS json request.
     Request example:
     rest_api/api/open/?uuid=uuidFromLocationHeader

     Response:
     201 Created no body
     **/
    function _sendRestMessage(body) {
        var request = {
            url: utils.templateStrings(connectionDetails.restPath + "/send", configuration),
            method: "POST",
            data: body,
            success: function (data) {
                if (data && data.body && data.body.length) {
                    for (var i = 0; i < data.body.length; i++) {
                        var message = data.body[i];
                        utils.runCallBack(configuration.message, message);
                    }
                }
                _scheduleNextPoll();
            },
            error: function (errData) {
                utils.error("Error on _sendRestMessage" + JSON.stringify(errData), name);
                _scheduleNextPoll();
            }
        };
        postmessage.issueCall(request);
    }

    /** Get messages from session
     GET
     Rel request url:
     rest_api/api/send
     query params:
     uuid - the one you received on Location header on Open API.
     Request example:
     rest_api/api/open/uuid=uuidFromLocationHeader
     Response:
     200 OK.
     Response will contain an array of all messages waiting on websocket.
     Response example:
     [{"kind":"resp","reqId":"1","code":200,"body":{"conversationId":"8ea5c6b8-6fa8-4154-a38c-d2aa07efc13a"},"type":".ams.cm.RequestConversation$Response"}]
     **/
    function _getMessages() {
        clearTimeout(pollingTimeoutId);
        var request = {
            url: utils.templateStrings(connectionDetails.restPath + "/poll", configuration),
            method: "GET",
            success: function (data) {
                if (data && data.body && data.body.length) {
                    for (var i = 0; i < data.body.length; i++) {
                        var message = data.body[i];
                        utils.runCallBack(configuration.message, message);
                    }
                } else {
                    utils.error("Error on _getMessages" + JSON.stringify(data), name);
                }
                _scheduleNextPoll();
            },
            error: function (errData) {
                utils.error("Error on _getMessages" + JSON.stringify(errData), name);
                _scheduleNextPoll();
            }
        };
        postmessage.issueCall(request);
    }

    /** Close the connection
     POST
     Rel request url:
     rest_api/api/close
     query params:
     uuid - the one you received on Location header on Open API.
     Request example:
     rest_api/api/close/uuid=uuidFromLocationHeader
     Response:
     200 OK
     **/
    function _closeConnection() {
        var request = {
            url: utils.templateStrings(connectionDetails.restPath + "/close", configuration),
            method: "POST",
            success: function(data){
                utils.runCallBack(configuration.closed, data);
            },
            error: function (errData) {
                utils.runCallBack(configuration.closed, errData);
                utils.error("Error on close connection" + JSON.stringify(errData), name);
            }
        };
        poll = false;
        postmessage.issueCall(request);
    }

    /***************Public API **********************/

    this.sendMessage = sendMessage;
    this.configure = configure;
    this.closeConnection = closeConnection;
    this.name = name;
    this.v = v;
    this.memberTypes = memberTypes;

};
