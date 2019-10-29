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
    MESSAGE: 'message',
    PONG: 'pong'
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
        this.isAlive = true;
    }

    _bindWsEvents() {
        this.ws.on(WS_EVENTS.OPEN, this._onOpen.bind(this));
        this.ws.on(WS_EVENTS.CLOSE, this._onClose.bind(this));
        this.ws.on(WS_EVENTS.ERROR, this._onError.bind(this));
        this.ws.on(WS_EVENTS.MESSAGE, this._onMessage.bind(this));
        this.ws.on(WS_EVENTS.PONG, this._onPong.bind(this));
    }

    _unbindWsEvents() {
        this.ws.removeListener(WS_EVENTS.OPEN, this._onOpen);
        this.ws.removeListener(WS_EVENTS.CLOSE, this._onClose);
        this.ws.removeListener(WS_EVENTS.ERROR, this._onError);
        this.ws.removeListener(WS_EVENTS.MESSAGE, this._onMessage);
        this.ws.removeListener(WS_EVENTS.PONG, this._onPong);
    }

    _onOpen() {
        this.emit('open');
        this._keepAlive();
    }

    _onClose(code, reason) {
        this.emit('close', code, reason);
        clearInterval(this.heartbeat);
    }

    _onError(err) {
        this.emit('error', err);
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

    _onPong(data) {
        this.emit('pong', data);
        this.isAlive = true;
    }

    _keepAlive() {
        this.heartbeat = setInterval( () => {
            if (this.isAlive == false) return this.ws.terminate();
            this.isAlive = false;
            this.ws.ping();
        }, this.pingInterval );
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
        clearInterval(this.heartbeat);
        this._unbindWsEvents();
        this.ws.terminate();
        this.ws = null;
    }

}

Transport.WS_EVENTS = WS_EVENTS;

module.exports = Transport;
