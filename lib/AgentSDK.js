'use strict';

const uuidV4 = require('uuid/v4');
const Transport = require('./Transport');
const Events = require('events');
const CONST = require('./Const');
const utils = require('./Utils');
const async = require('async');
const external = require('./ExternalServices');
const Transformer = require('./Transformer');
const SDKError = require('./error/SDKError');
const TransformError = require('./error/TransformError');
const CSDSClient = require('./CSDSClient');
const { SERVICES, AUTH_SERVICE_CONTEXT } = require('./Const');

/**
 * conf = {
 *     accountId: Number,
 *     username: String,
 *     password: String,
 *     token: String, // a bearer token instead of username and password
 *     userId: String, // the user id - mandatory when using token as authentication method
 *     assertion: String, // a SAML assertion to be used instead of token or username and password
 *     appKey: String, // oauth1 keys needed (with username) to be used instead of assertion or token or username and password
 *     secret: String,
 *     accessToken: String,
 *     accessTokenSecret: String,
 *     csdsDomain: String, // override the CSDS domain if needed
 *     requestTimeout: Number, // default to 10000 milliseconds
 *     errorCheckInterval: Number, // defaults to 1000 milliseconds
 *     apiVersion: Number // Messaging API version - defaults to 2 (version 1 is not supported anymore)
 *     refreshSessionInterval: Number // Interval of bearer token refresh
 * }
 *
 * @property {Function} subscribeExConversations
 * @property {Function} subscribeAgentsState
 * @property {Function} subscribeRoutingTasks
 * @property {Function} subscribeMessagingEvents
 * @property {Function} updateRoutingTaskSubscription
 * @property {Function} unsubscribeExConversations
 * @property {Function} setAgentState
 * @property {Function} getClock
 * @property {Function} getUserProfile
 * @property {Function} updateRingState
 * @property {Function} agentRequestConversation
 * @property {Function} updateConversationField
 * @property {Function} generateURLForDownloadFile
 * @property {Function} generateURLForUploadFile
 * @property {Function} publishEvent
 * @property {Function} reconnect
 * @property {Function} dispose
 * @property {Function} connect
 * @property {Function} startPeriodicRefreshSession
 * @property {Function} refreshSession
 * @property {Function} getBearerToken
 */
class SDK extends Events {

    constructor(conf) {
        super();

        // verify that an accountId is present
        if (!conf.accountId) {
            throw new Error('missing accountId param');
        }

        // verify that we have all the pieces to login
        if (!conf.token && (!conf.username || !conf.password) && !conf.assertion &&
            (!conf.username || !conf.appKey || !conf.secret || !conf.accessToken || !conf.accessTokenSecret)) {
            throw new Error('missing token or user/password or assertion or appKey/secret/accessToken/accessTokenSecret params');
        }

        // set default for refreshSessionToken
        if (!conf.hasOwnProperty('refreshSessionToken')) {
            conf.refreshSessionToken = true;
        }

        // initialize the WS requests - add them as functions to this object
        this._registerRequests(CONST.REQUESTS);

        this.refreshSessionInterval = conf.refreshSessionInterval || (60000 * 10);//10 min
        this.conf = conf;

        // create the CSDS client
        this.csdsClient = new CSDSClient(this.conf);
        this.accountId = conf.accountId;

        // connect
        this.connect(() => {});
    }

    /**************************************************
     *              Public Interfaces                 *
     **************************************************/

    /**
     * Establish a WS connection for the agent. This also logins the agent.
     * You might want to call this function in the very beginning of the agent lifecycle.
     * @param connectCallback - function(err) - Callback function where the error object will be provided
     */
    connect(connectCallback) {
        async.waterfall([
            // 1. get CSDS entries
            (callback) => this._handleCSDS('Connect#CSDS', callback),
            (domains, callback) => {
                Object.assign(domains, this.conf.domains);
                callback(null, domains);
            },

            // 2. login
            (domains, callback) => this._handleLogin(domains, 'Connect#Login', callback),
        ], (err, token, domains) => {
            if (err) {
                return connectCallback(err);
            }

            // 3. init
            
            // Checking if any valid web socket domain type is passed in config else facadeMsg is default type.
            const wsDomain = this.conf.wsDomainType && domains[this.conf.wsDomainType] ? domains[this.conf.wsDomainType]: domains.facadeMsg;
            this._init(Object.assign({
                domain: wsDomain,
                token: token
            }, this.conf));

            connectCallback(null);
        });
    }

    /**
     * Reconnect WS connections for agents
     * You might want to call this function in an event of a failure, when the connection will need
     * to be re-established
     * @param dontRegenerateToken - if this flag is true, the agent will not try to get a new bearer token, and only reconnect the WS connection
     */
    reconnect(dontRegenerateToken) {
        if (dontRegenerateToken) {
            if (this.transport) this.transport.reconnect();
            return;
        }

        // stop refresh
        clearTimeout(this.refreshSessionTimeoutId);

        // 1. get CSDS entries
        this.csdsClient.getAll((err, domains) => {
            const domainsError = !domains ? new SDKError('could not fetch domains on reconnect', null, SERVICES.DOMAIN_NAMES) : null;
            const actualError = err ? err : domainsError;
            this._emitStatusEvents(actualError, 'Reconnect#CSDS');
            if (actualError) {
                return;
            }

            this._handleLoginAndReconnect(domains, 'Reconnect#Relogin#WS', () => {});
        });
    }

    /**
     * Dispose all connections, event listeners, and timers connected to this agent
     * You might want to call this function in the end of the agent life cycle
     */
    dispose() {
        clearTimeout(this.errorTimeoutId);
        clearTimeout(this.refreshSessionTimeoutId);
        if (this.transport) {
            this.transport.removeAllListeners('open');
            this.transport.close();
        }
        this.removeAllListeners();
        this.transport = null;
        this.connected = false;
    }

    /**
     * Get the bearer token of the current agent
     * @returns {String.bearer|*}
     */
    getBearerToken() {
        return this.token;
    }

    /**
     * Start a periodic call to refresh the HTTP session, thus prolonging the lifetime of the bearer token
     * The default time for the interval of call is 10 minutes.
     */
    startPeriodicRefreshSession() {
        // Cancel all refresh session
        clearTimeout(this.refreshSessionTimeoutId);

        // Start periodic call
        this.refreshSessionTimeoutId = setTimeout(() => {
            this.refreshSession(() => {
                // Re-call function after the last one passed
                this.startPeriodicRefreshSession();
            });
        }, this.refreshSessionInterval);
    }

    /**
     * Asynchronously refresh the HTTP session of the agent, thus prolonging the bearer token lifetime
     * @param sessionCallback - function(err: Error) - the callback to check for errors
     */
    refreshSession(sessionCallback) {
        const error = this._preCheckRefreshSession();
        if (error) {
            return sessionCallback(error);
        }

        async.waterfall([
            // 1. Get CSDS domain
            (callback) => this._handleCSDS('RefreshSession#CSDS', callback),

            // 2. Call Refresh Session
            (domains, callback) => {

                // Will still need to go to the next async step to check for error codes
                this._handleRefreshSessionCall(domains, 'RefreshSession#REST', (err, domains) => {
                    callback(null, err, domains);
                });
            },

            // 3. Call re-login when 401 is encountered (need the error object from previous task to be propagated)
            (err, domains, callback) => {

                // Re-connect on 401
                if (err && err.code === 401) {
                    this._handleLoginAndReconnect(domains, 'RefreshSession#Relogin#WS', callback);
                } else {
                    callback(err);
                }
            }
        ], (err) => {
            sessionCallback(err);
        });
    }

    /**************************************************
     *              Private Interfaces                *
     **************************************************/

    _loginAndReconnect(domains, callback) {
        this._login(this.conf, domains, (err, token) => {
            if (err) {
                callback(err);
            } else if (!token) {
                callback(new SDKError('could not generate token', null, AUTH_SERVICE_CONTEXT.LOGIN));
            } else if (this.transport) {
                this.transport.configuration.token = token;
                this.transport.reconnect();
                callback(null);
            } else {
                // 3. init
                
                // Checking if any valid web socket domain type is passed in config else facadeMsg is default type.
                const wsDomain = this.conf.wsDomainType && domains[this.conf.wsDomainType] ? domains[this.conf.wsDomainType]: domains.facadeMsg;
                this._init(Object.assign({
                    domain: wsDomain,
                    token: token
                }, this.conf));
                callback(null);
            }
        });
    }

    // gets a bearer token from agentVEP
    _login(conf, domains, callback) {

        // make sure we've gotten the agentVep host
        if (!domains.agentVep) {
            return callback(new SDKError('could not fetch domains', null, SERVICES.DOMAIN_NAMES));
        }

        // if there is a token passed in, use that
        if (conf.token) {
            this.userId = conf.userId; //for internal use
            this.__oldAgentId = `${conf.accountId}.${conf.userId}`; //for external use
            return callback(null, conf.token, domains);
        }

        let loginData = Object.assign({domain: domains.agentVep}, conf);

        external.login(loginData, (err, data, cookies) => {

            if (err) {
                return callback(err, null, domains);
            }

            this.agentId = data && data.config && data.config.userPid;

            // get userId and use to generate __oldAgentId
            this.userId = data && data.config && data.config.userId; // for internal use
            if (typeof this.userId !== 'undefined') {
                this.__oldAgentId = `${conf.accountId}.${this.userId}`; // for external use
            }

            // if userId is undefined then we need to throw an error
            else {

                // first log this incident as a warning
                if (typeof data === 'undefined') data = '[undefined]';
                else {
                    if (data.hasOwnProperty('accountData')) delete data.accountData;
                    if (data.hasOwnProperty('csdsCollectionResponse')) delete data.csdsCollectionResponse;
                }
                // console.warn(`invalid login state, userId is undefined, data: ${JSON.stringify(data)}`);

                // then emit an error
                let err = new SDKError('invalid login state, userId is undefined', null, AUTH_SERVICE_CONTEXT.LOGIN); // make sure to have whole response - data
                return callback(err, null, domains);
            }

            // throw an error (wont work without promises :( )
            // or callback with different error

            if (data && data.csrf) {
                this.jar = cookies;
                this.csrf = data.csrf;
                this.token = data.bearer;

                // start the session token refresh
                if (this.conf.conf.refreshSessionToken) {
                    this.startPeriodicRefreshSession();
                }
            }

            callback(err, data && data.bearer, domains);
        });
    }

    _init(options) {
        this.pendingRequests = {};
        this.requestTimeout = options.requestTimeout || 10000;

        this.errorCheckInterval = options.errorCheckInterval || 1000;

        this.transport = new Transport(options);
        this.transport.on('message', (message) => this._handleMessage(message));
        this.transport.on('close', (data) => this._handleClosed(data));
        this.transport.on('open', (data) => this._handleSocketCreated(data));
        this.transport.on('error', (err) => this.emit('error', err));//proxy the error out
        this.transport.on('message:sent', (message) => this.emit('message:sent', message));//proxy the message out
    }

    // takes each WS request type and creates a function on this object to invoke that request
    _registerRequests(arr) {

        // old nightmare line
        //arr.forEach(reqType => this[utils.toFuncName(reqType)] = (body, headers, metadata, encodedMetadata, callback) => this._registerRequest(reqType, body, headers, metadata, encodedMetadata, callback));

        arr.forEach(reqType => {

            // generate the function name
            let key = utils.toFuncName(reqType);

            // create it as a function
            this[key] = (body, headers, metadata, encodedMetadata, callback) => {
                this._createAndSendRequest(reqType, body, headers, metadata, encodedMetadata, callback);
            };

        });
    }

    /**
     *
     * @param {string} type UMS request type
     * @param {object} body UMS request body
     * @param {object} [headers] UMS request headers
     * @param {object} [metadata] UMS request metadata
     * @param {string} [encodedMetadata] encoded metadata
     * @param {callback} callback node style callback for request completion/error/timeout
     * @return {string} if the socket is connect returns the request id, otherwise undefined.
     */
    _createAndSendRequest(type, body, headers, metadata, encodedMetadata, callback) {
        if (typeof headers === 'function') {
            callback = headers;
            headers = void 0;
            metadata = void 0;
            encodedMetadata = void 0;
        }
        else if (typeof metadata === 'function') {
            callback = metadata;
            metadata = void 0;
            encodedMetadata = void 0;
        } else if (typeof encodedMetadata === 'function') {
            callback = encodedMetadata;
            encodedMetadata = void 0;
        }

        // transform
        if (Transformer[type]) {
            // body = Transformer[type](body);
            ({body, type, headers, metadata, encodedMetadata} = Transformer[type]({body, type, headers, metadata, encodedMetadata}, this));
        }

        // create the request
        const msg = {
            kind: CONST.KINDS.REQUEST,
            id: uuidV4(),
            type: type,
            body: body || {},
            headers: headers,
            metadata: metadata,
            encodedMetadata: encodedMetadata
        };

        // send the request
        return this._queueForResponseAndSend(msg, callback);
    }

    // Reports if an async task is successful or not
    _emitStatusEvents(err, location) {
        const context = { location };
        if (err) {
            this.emit('error', err, context);
        } else {
            this.emit('success', context);
        }
    }

    // Handle CSDS calls and emit specific events based on error
    _handleCSDS(location, callback) {
        this.csdsClient.getAll((err, domains) => {
            this._emitStatusEvents(err, location);
            callback(err, domains);
        });
    }

    // Handle login calls and emit specific events based on error
    _handleLogin(domains, location, callback) {
        this._login(this.conf, domains, (err, token, domains) => {
            const tokenError = !token ? new SDKError('could not generate token', null, AUTH_SERVICE_CONTEXT.LOGIN) : null;
            const actualError = err ? err : tokenError;
            this._emitStatusEvents(actualError, location);
            callback(actualError, token, domains);
        });
    }

    // Handle login and reconnect and emit specific events base on error
    _handleLoginAndReconnect(domains, location, callback) {
        this._loginAndReconnect(domains, (err) => {
            this._emitStatusEvents(err, location);
            callback(err);
        });
    }

    // Handle Refresh Session calls
    _handleRefreshSessionCall(domains, location, callback) {
        external.refreshSession({
            accountId: this.accountId,
            domain: domains.agentVep,
            csrf: this.csrf,
            jar: this.jar
        }, (err) => {
            // We retry on error codes 401, do NOT emit status events on 401
            if (!err || err.code !== 401) {
                this._emitStatusEvents(err, location);
            }
            callback(err, domains);
        });
    }

    _preCheckRefreshSession() {
        const isCSRForJarUndefined = !this.csrf || !this.jar;
        const error = isCSRForJarUndefined ? new SDKError('CSRF and JAR are not defined for this agent. Please reconnect with bearer token.', null, AUTH_SERVICE_CONTEXT.LOGIN) : null;
        this._emitStatusEvents(error, 'RefreshSession#Precheck');
        return error;
    }

    _handleMessage(msg) {
        switch (msg.kind) {
            case CONST.KINDS.NOTIFICATION:
                this._handleNotification(msg);
                break;
            case CONST.KINDS.RESPONSE:
                this._handleResponse(msg);
                break;
        }
    }

    _handleSocketCreated(data) {
        this.connected = true;
        this.emit(CONST.EVENTS.CONNECTED, data || {connected: true, ts: Date.now()});
    }

    _queueForResponseAndSend(request, callback) {
        if (request && this.connected) {
            this._queueForResponse(request.id, callback);
            this.transport.send(request);
            return request.id;
        } else {
            callback(new SDKError('socket not connected', null, SERVICES.MESSAGING));
        }
    }

    _queueForResponse(id, callback) {
        if (id && callback) {
            this.pendingRequests[id] = {
                callback: callback,
                launchTime: Date.now(),
                timeout: this.requestTimeout
            };
            this.errorTimeoutId = setTimeout(() => this._checkForErrors(), this.errorCheckInterval);
        }
    }

    _checkForErrors() {
        clearTimeout(this.errorTimeoutId);
        const now = Date.now();
        const timedOutCallbacks = [];
        let pendReqCount = 0;
        for (let key in this.pendingRequests) {//Check for requests taking too long
            if (this.pendingRequests.hasOwnProperty(key) && this.pendingRequests[key].launchTime) {
                const timeElapsed = now - this.pendingRequests[key].launchTime;
                if (timeElapsed > this.pendingRequests[key].timeout) {//Queue error callback
                    timedOutCallbacks.push(key);
                } else {
                    pendReqCount++;
                }
            }
        }
        if (timedOutCallbacks.length) {
            for (let i = 0; i < timedOutCallbacks.length; i++) {//Execute the callbacks
                this._notifyOutCome(timedOutCallbacks[i], new SDKError('Request has timed out', null, SERVICES.MESSAGING), true);
            }
        }
        if (pendReqCount > 0) {
            this.errorTimeoutId = setTimeout(() => this._checkForErrors(), this.errorCheckInterval);
        }
    }

    _handleClosed(data) {
        this.connected = false;
        this._notifySocketClosedFailure();
        this.emit(CONST.EVENTS.CLOSED, data || {connected: false, ts: Date.now()});
    }

    _notifySocketClosedFailure() {
        for (let key in this.pendingRequests) {
            if (this.pendingRequests.hasOwnProperty(key)) {
                this._notifyOutCome(key, new SDKError('Request has timed out', null, SERVICES.MESSAGING), true);
            }
        }
    }

    _handleNotification(msg) {
        if (msg && msg.type) {
            msg = this._transformMsg(msg);
            if (msg === null) return;
            this.emit(msg.type, msg.body);
        }
        this.emit(CONST.EVENTS.NOTIFICATION, msg);
    }

    _handleResponse(msg) {
        if (msg && msg.type) {
            msg = this._transformMsg(msg);
            if (msg === null) return;
            this.emit(msg.type, msg.body, msg.reqId);
        }
        this._handleOutcome(msg);
    }

    _handleOutcome(msg) {
        if (typeof msg.code !== 'undefined' && msg.code > 399) {
            this._notifyOutCome(msg.reqId, msg, true);
        } else {
            this._notifyOutCome(msg.reqId, msg, false);
        }
    }

    _notifyOutCome(id, data, error) {
        if (this.pendingRequests[id]) {
            if (this.pendingRequests[id].callback) {
                this.pendingRequests[id].callback(error ? data : null, data.body);
            }
            this._dequeMessage(id);
        }
    }

    _dequeMessage(id) {
        for (let key in this.pendingRequests[id]) {
            if (this.pendingRequests[id].hasOwnProperty(key)) {
                this.pendingRequests[id][key] = null;
                delete this.pendingRequests[id][key];
            }
        }
        this.pendingRequests[id] = null;
        delete this.pendingRequests[id];
    }

    _transformMsg(msg) {
        if (Transformer[msg.type]) {
            try {
                return Transformer[msg.type](msg, this);
            } catch (error) {
                //throw new TransformError(error, msg);
                this.emit('error', new TransformError(error, msg));
                return null;
            }
        }
        return msg;
    }
}

module.exports = SDK;
