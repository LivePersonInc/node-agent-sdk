'use strict';

/**
 * domain : domain,
 * token: token,
 * apiVersion: 1/2
 * @param config
 * @constructor
 */
const WebSocket = require('ws');
const Events = require('events');
const SDKError = require('./error/SDKError');
const { SERVICES } = require('./Const');

const connectionDetails = {
    wsPath: data =>
        `wss://${data.domain}/ws_api/account/${
            data.accountId
            }/messaging/brand/${data.token}?v=${data.apiVersion}`
};

const defaults = {
    apiVersion: 2.1
};

const WS_EVENTS = {
    OPEN: 'open',
    CLOSE: 'close',
    ERROR: 'error',
    MESSAGE: 'message'
};

class Transport extends Events {
    constructor(config) {
        super();
        this.pingInterval = 60000;
        this.configuration = Object.assign({}, defaults, config);
        this._connect();
    }

    _connect() {
        this.ws = new WebSocket(
            connectionDetails.wsPath(this.configuration),
            this.configuration
        );
        this._bindWsEvents();
    }

    _bindWsEvents() {
        this.ws.on(WS_EVENTS.OPEN, this._onOpen.bind(this));
        this.ws.on(WS_EVENTS.CLOSE, this._onClose.bind(this));
        this.ws.on(WS_EVENTS.ERROR, this._onError.bind(this));
        this.ws.on(WS_EVENTS.MESSAGE, this._onMessage.bind(this));
    }

    _unbindWsEvents() {
        this.ws.removeListener(WS_EVENTS.OPEN, this._onOpen);
        this.ws.removeListener(WS_EVENTS.CLOSE, this._onClose);
        this.ws.removeListener(WS_EVENTS.ERROR, this._onError);
        this.ws.removeListener(WS_EVENTS.MESSAGE, this._onMessage);
    }

    _onOpen() {
        this.emit('open');
        this.ping();
    }

    _onClose(code, reason) {
        this.emit('close', code, reason);
        clearTimeout(this.timoutId);
    }

    _extractCode(err) {
        if (err.message && err.message.includes('401')) {
            return 401;
        }
        return null;
    }

    _onError(err) {
        const code = this._extractCode(err);
        const error = new SDKError(`Error on WS connection: ${err.message}`, code, SERVICES.MESSAGING, err);
        this.emit('error', error);
        clearTimeout(this.timoutId);
    }

    _onMessage(data, flags) {
        let parsed;
        try {
            parsed = JSON.parse(data);
        } catch (ex) {
            // continue regardless of error
        }
        this.emit('message', parsed || data, flags);
    }

    ping() {
        try {
            this.ws.ping();
            this.timoutId = setTimeout(() => {
                this.ping();
            }, this.pingInterval);
        }
        catch (err) {
            const error = new SDKError(`Error on WS ping: ${err.message}`, null, SERVICES.MESSAGING, err);
            this.emit('error', error);
        }
    }

    send(message) {
        this.ws.send(JSON.stringify(message));
        this.emit('message:sent', message);
    }

    reconnect() {
        this.close();
        this._connect();
    }

    close() {
        clearTimeout(this.timoutId);
        if (!this.ws) {
            return;
        }
        this._unbindWsEvents();
        this.ws.terminate();
        this.ws = null;
    }
}

Transport.WS_EVENTS = WS_EVENTS;

module.exports = Transport;
