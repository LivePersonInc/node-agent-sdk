'use strict';

const uuidV4 = require('uuid/v4');
const Transport = require('./Transport');
const Events = require('events');
const CONST = require('./Const');
const utils = require('./Utils');
const async = require('async');
const external = require('./ExternalServices');
const Transformer = require('./Transformer');

/**
 * conf = {
 *  accountId: String,
 *  token: String [or username & password]
 *  username: String [or token]
 *  password: String [or token]
 *  csdsDomain: String [optional]
 *  apiVersion: String [optional]
 * }
 */
class SDK extends Events {
    constructor(conf) {
        super();
        if (!conf.accountId) {
            throw new Error('missing accountId param');
        }
        if (!conf.token && (!conf.username && !conf.password)) {
            throw new Error('missing token or user/password params');
        }
        async.waterfall([
            async.apply(external.getDomains, conf.accountId, conf.csdsDomain),
            (domains, callback) => {
                if (domains.agentVep) {
                    if (!conf.token) {
                        external.login({
                            domain: domains.agentVep,
                            username: conf.username,
                            password: conf.password,
                            accountId: conf.accountId
                        }, (err, data) => {
                            this.accountId = conf.accountId;
                            this.__oldAgentId = `${conf.accountId}.${data && data.config && data.config.userId}`; //for external use
                            this.userId = data && data.config.userId; //for internal use
                            callback(err, data && data.bearer, domains);
                        });
                    }
                    else {
                        callback(null, conf.token, domains);
                    }
                }
                else {
                    callback(new Error('could not fetch domains'));
                }
            },
            (token, domains, callback) => {
                external.getAgentId({
                    domain: domains.accountConfigReadWrite,
                    token: token,
                    user: this.userId,
                    accountId: conf.accountId
                }, (err, data) => {
                    // TODO: Ugly hack, remove it later.
                    // Currently there is a bug in the ac-users.
                    // Transoformers adds convDetails.getMyRole() and ms.MessagingEvents.isMe()

                    // Uncomment this line after fixing ac-users
                    // this.agentId = data && data.pid;
                    this.agentId = {error: "agentId not supported yet. Use convDetails.getMyRole() and ms.MessagingEvents.isMe()."};

                    callback(err, token, domains);
                });
            }
        ], (err, token, domains) => {
            if (err || !token) {
                this.emit('error', err || new Error('could not generate token'));
            }
            else {
                this._init(Object.assign({
                    domain: domains.asyncMessagingEnt,
                    token: token
                }, conf));
            }
        });
    }

    _init(options) {
        this.transport = new Transport(options);
        this.pendingRequests = {};

        this.requestTimeout = options.requestTimeout || 10000;
        this.errorCheckInterval = options.errorCheckInterval || 1000;

        this.registerRequests(CONST.REQUESTS);
        this.transport.on('message', (message) => this._handleMessage(message));
        this.transport.on('close', (data) => this._handleClosed(data));
        this.transport.on('open', (data) => this._handleSocketCreated(data));
        this.transport.on('error', (err) => this.emit('error', err));//proxy the error out
    }

    request(type, body, headers, callback) {
        if (typeof headers === 'function') {
            callback = headers;
            headers = void 0;
        }

        if (Transformer[type]) {
            // body = Transformer[type](body);
            ({body, type, headers} = Transformer[type]({body, type, headers},this));

        }

        let msg = {
            kind: CONST.KINDS.REQUEST,
            id: uuidV4(),
            type: type,
            body: body || {},
            headers: headers
        };
        return this._queueForResponseAndSend(msg, callback);
    }

    registerRequests(arr) {
        arr.forEach(reqType => this[utils.toFuncName(reqType)] = (body, headers, callback) => this.request(reqType, body, headers, callback));
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
        }
        else {
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
                }
                else {
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
                msg = Transformer[msg.type](msg,this);
            }
            this.emit(msg.type, msg.body);
        }
        this.emit(CONST.EVENTS.NOTIFICATION, msg);
    }

    _handleResponse(msg) {
        if (msg && msg.type) {
            if (Transformer[msg.type]) {
                msg = Transformer[msg.type](msg,this);
            }
            this.emit(msg.type, msg.body, msg.reqId);
        }
        this._handleOutcome(msg);
    }

    _handleOutcome(msg) {
        if (typeof msg.code !== 'undefined' && msg.code > 399) {
            this._notifyOutCome(msg.reqId, msg, true);
        }
        else {
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
