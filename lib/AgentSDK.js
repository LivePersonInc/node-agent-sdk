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
const CSDSClient = require('./CSDSClient');

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
 * @property {Function} publishEvent
 * @property {Function} reconnect
 * @property {Function} dispose
 */
class SDK extends Events {
    constructor(conf) {
        super();
        if (!conf.accountId) {
            throw new Error('missing accountId param');
        }
        if (!conf.token && (!conf.username || !conf.password) && !conf.assertion &&
            (!conf.username || !conf.appKey || !conf.secret || !conf.accessToken || !conf.accessTokenSecret)) {
            throw new Error('missing token or user/password or assertion or appKey/secret/accessToken/accessTokenSecret params');
        }
        this.registerRequests(CONST.REQUESTS);

        this.refreshSessionInterval = conf.refreshSessionInterval || (60000 * 10);//10 min
        this.conf = conf;
        this.csdsClient = new CSDSClient(this.conf);
        async.waterfall([
            (callback) => this.csdsClient.getAll(callback),
            (domains, callback) => {
                Object.assign(domains, conf.domains);
                callback(null, domains);
            },
            (domains, callback) => this._login(conf, domains, callback)
        ], (err, token, domains) => {
            if (err || !token) {
                this.emit('error', err || new Error('could not generate token'));
            } else {
                this._init(Object.assign({
                    domain: domains.asyncMessagingEnt,
                    token: token
                }, conf));
            }
        });
    }

    _login(conf, domains, callback) {
        if (domains.agentVep) {
            if (!conf.token) {
                let loginData = Object.assign({domain: domains.agentVep}, conf);
                external.login(loginData, (err, data, cookies) => {
                    this.accountId = conf.accountId;
                    this.__oldAgentId = `${conf.accountId}.${data && data.config && data.config.userId}`; //for external use
                    this.userId = data && data.config && data.config.userId; //for internal use
                    this.agentId = data && data.config && data.config.userPid;
                    if (data && data.csrf) {
                        this.jar = cookies;
                        this.csrf = data.csrf;
                        this._refreshSession();
                    }
                    callback(err, data && data.bearer, domains);
                });
            } else {
                this.userId = conf.userId; //for internal use
                this.__oldAgentId = `${conf.accountId}.${conf.userId}`; //for external use
                callback(null, conf.token, domains);
            }
        } else {
            callback(new Error('could not fetch domains'));
        }
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

    /**
     *
     * @param {string} type UMS request type
     * @param {object} body UMS request body
     * @param {object} [headers] UMS request headers
     * @param {object} [metadata] UMS request metadata
     * @param {callback} callback node style callback for request completion/error/timeout
     * @return {string} if the socket is connect returns the request id, otherwise undefined.
     */
    request(type, body, headers, metadata, callback) {
        if (typeof headers === 'function') {
            callback = headers;
            headers = void 0;
            metadata = void 0;
        }
        else if (typeof metadata === 'function') {
            callback = metadata;
            metadata = void 0;
        }

        if (Transformer[type]) {
            // body = Transformer[type](body);
            ({body, type, headers, metadata} = Transformer[type]({body, type, headers, metadata}, this));

        }

        const msg = {
            kind: CONST.KINDS.REQUEST,
            id: uuidV4(),
            type: type,
            body: body || {},
            headers: headers,
            metadata: metadata
        };
        return this._queueForResponseAndSend(msg, callback);
    }

    registerRequests(arr) {
        arr.forEach(reqType => this[utils.toFuncName(reqType)] = (body, headers, metdata, callback) => this.request(reqType, body, headers, metdata, callback));
    }

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

    reconnect(dontRegenerateToken) {
        if (!dontRegenerateToken) {
            clearTimeout(this.refreshSessionTimeoutId); //stop refresh
            this.csdsClient.getAll((err, domains) => {
                if (!err && domains) {
                    this._login(this.conf, domains, (err, token) => {
                        if (err || !token) {
                            this.emit('error', err || new Error('could not generate token'));
                        } else if (this.transport) {
                            this.transport.configuration.token = token;
                            this.transport.reconnect();
                        } else {
                            this._init(Object.assign({
                                domain: domains.asyncMessagingEnt,
                                token: token
                            }, this.conf));
                        }
                    });
                } else {
                    this.emit('error', err || new Error('could not fetch domains on reconnect'));
                }
            });
        } else if (this.transport) {
            this.transport.reconnect();
        }
    }

    _refreshSession(err, data) {
        clearTimeout(this.refreshSessionTimeoutId);
        this.csdsClient.getAll((csdsErr, domains) => {
            if (!err && !csdsErr && (!data || !data.error) && this.csrf && domains) {
                this.refreshSessionTimeoutId = setTimeout(() => external.refreshSession({
                    accountId: this.accountId,
                    domain: domains.agentVep,
                    csrf: this.csrf,
                    jar: this.jar
                }, (err, data) => this._refreshSession(err, data)), this.refreshSessionInterval);
            } else {
                this.emit('error', err || new SDKError('could not refresh token', 401));
            }
        });
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
            callback(new Error('socket not connected'));
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
                this._notifyOutCome(timedOutCallbacks[i], new Error('Request has timed out'), true);
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
                this._notifyOutCome(key, new Error('Request has timed out'), true);
            }
        }
    }

    _handleNotification(msg) {
        if (msg && msg.type) {
            if (Transformer[msg.type]) {
                msg = Transformer[msg.type](msg, this);
            }
            this.emit(msg.type, msg.body);
        }
        this.emit(CONST.EVENTS.NOTIFICATION, msg);
    }

    _handleResponse(msg) {
        if (msg && msg.type) {
            if (Transformer[msg.type]) {
                msg = Transformer[msg.type](msg, this);
            }
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
}

module.exports = SDK;
