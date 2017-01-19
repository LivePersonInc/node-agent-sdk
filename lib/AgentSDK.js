'use strict';
const uuidV4 = require('uuid/v4');
const Transport = require('./Transport');
const Events = require('events');
const CONST = require('./Const');
const utils = require('./Utils');
const async = require('async');
const external = require('./ExternalServices');
const timeoutError = new Error('Request has timed out');

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
        if (!conf.token || (!conf.username && !conf.password)) {
            throw new Error('missing token or user/password params');
        }


        async.waterfall([
            async.apply(external.getDomains, conf.accountId, conf.csdsDomain),
            (domains, callback) => {
                if (!conf.token) {
                    external.login({
                        domain: domains.agentVep,
                        username: conf.username,
                        password: conf.password
                    }, (err, token) => {
                        callback(err, token, domains);
                    });
                } else {
                    callback(null, conf.token, domains);
                }
            }
        ], (err, token, domains) => {
            if (err) {
                this.emit('error', err);
            } else {
                this._init({
                    domain: domains.asyncMessaging,
                    token: token,
                    accountId: conf.accountId,
                    apiVersion: conf.apiVersion
                });
            }
        });
    }

    _init(options) {
        this.transport = new Transport({
            domain: options.domain,
            token: options.token,
            accountId: options.accountId,
            apiVersion: options.apiVersion
        });
        this.pendingMessages = {};
        this.pendingServerRequests = [];

        this.requestTimeout = 10000; //pus part of conf and defaults
        this.errorCheckInterval = 1000;
        this.pingInterval = 10000;
        this.pingTimeout = 10000;

        this.registerRequests();
        this.transport.on('message', (message) => this._handleMessage(message));
        this.transport.on('close', (data) => this._handleClosed(data));
        this.transport.on('open', (data) => this._handleSocketCreated(data));
        this.transport.on('error', (err) => this.emit('error', err));//proxy the error out
    }

    request(type, body, options, headers) {

        let msg = {
            kind: CONST.KINDS.REQUEST,
            id: uuidV4(),
            type: type,
            body: body || {},
            headers: headers
        };
        return this._queueForResponseAndSend(msg, options);
    }

    registerRequests() {
        CONST.REQUESTS.forEach(reqType => this[utils.toFuncName(reqType)] = (body, options, headers) => this.request(reqType, body, options, headers));
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
        this._ping();
        this.emit(CONST.EVENTS.CONNECTED, data || {connected: true, ts: new Date().getTime()});
        this._sendPendingRequests();
    }

    _ping() {
        this.request('.GetClock', {}, {
            success: (data) => this._pingCallback(data),
            error: (data) => this._pingCallback(data),
            timeout: this.pingTimeout
        });
    }

    _pingCallback(data) {
        if (!(data && data.state === 'PING_SUCCESS')) {
            this.emit(CONST.EVENTS.SERVICE_ISSUE, data || {connected: false, ts: Date.now()});
        }
        setTimeout(() => this._ping(), this.pingInterval); //TODO: should we still do it when error?
    }

    _sendPendingRequests() {
        while (this.pendingServerRequests.length > 0 && this.connected) {
            let requestData = this.pendingServerRequests.shift();
            this._queueForResponseAndSend(requestData.request, requestData.options);
        }
    }

    _queueForResponseAndSend(request, options = {}) {//TODO: will not handle not ready - will throw an error
        if (request && this.connected) {//TODO: don't think we need the connected attribute - can just publish an event when ready
            this._queueForResponse(request.id, options);
            this.transport.send(request);
            return request.id;
        }
    }

    _queueForResponse(id, options) {
        if (id && options && (options.success || options.error)) {
            this.pendingMessages[id] = {
                error: options.error,
                success: options.success,
                context: options.context,
                launchTime: Date.now(),
                timeout: options.timeout || this.requestTimeout
            };
            this.errorTimeoutId = setTimeout(() => this._checkForErrors(), this.errorCheckInterval);
        }
    }

    _checkForErrors() {
        clearTimeout(this.errorTimeoutId);
        const now = Date.now();
        const timedOutCallbacks = [];
        let pendReqCount = 0;
        for (let key in this.pendingMessages) {//Check for requests taking too long
            if (this.pendingMessages.hasOwnProperty(key) && this.pendingMessages[key].launchTime) {
                const timeElapsed = now - this.pendingMessages[key].launchTime;
                if (timeElapsed > this.pendingMessages[key].timeout) {//Queue error callback
                    timedOutCallbacks.push(key);
                } else {
                    pendReqCount++;
                }
            }
        }
        if (timedOutCallbacks.length) {
            for (let i = 0; i < timedOutCallbacks.length; i++) {//Execute the callbacks
                this._notifyOutCome(timedOutCallbacks[i], timeoutError, true);
            }
        }
        if (pendReqCount > 0) {
            this.errorTimeoutId = setTimeout(() => this._checkForErrors(), this.errorCheckInterval);
        }
    }


    _handleClosed(data) {
        this.connected = false;
        this._notifySocketClosedFailure();
        this.emit(CONST.EVENTS.CLOSED, data || {connected: false, ts: new Date().getTime()});
    }

    _notifySocketClosedFailure() {
        for (let key in this.pendingMessages) {
            if (this.pendingMessages.hasOwnProperty(key)) {
                this._notifyOutCome(key, timeoutError, true);
            }
        }
    }

    _handleNotification(msg) {
        if (msg && msg.type) {
            this.emit(msg.type, msg.body);
        }
        this.emit(CONST.EVENTS.MSG_RECEIVE, {});
    }

    _handleResponse(msg) {
        if (msg && msg.type) {
            this.emit(msg.type, msg.body, msg.reqId);
        }
        this._handleOutcome(msg);
        this.emit(CONST.EVENTS.MSG_RECEIVE, {});
    }

    _handleOutcome(msg) {
        if (typeof msg.code !== 'undefined' && msg.code > 399) {
            this._notifyOutCome(msg.reqId, msg.body, true);
        } else {
            this._notifyOutCome(msg.reqId, msg.body, false);
        }
    }

    _notifyOutCome(id, data, error) {
        if (this.pendingMessages[id]) {
            utils.runCallBack(error ? this.pendingMessages[id].error : this.pendingMessages[id].success, data, this.pendingMessages[id].context);
            this._dequeMessage(id);
        }
    }

    _dequeMessage(id) {
        for (let key in this.pendingMessages[id]) {
            if (this.pendingMessages[id].hasOwnProperty(key)) {
                this.pendingMessages[id][key] = null;
                delete this.pendingMessages[id][key];
            }
        }
        this.pendingMessages[id] = null;
        delete this.pendingMessages[id];
    }
}

module.exports = SDK;
