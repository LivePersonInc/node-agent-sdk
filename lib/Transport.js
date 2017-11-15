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
    wsPath: data => `wss://${data.domain}/ws_api/account/${data.accountId}/messaging/brand/${data.token}?v=${data.apiVersion}`
};

const defaults = {
    apiVersion: 2
};

class Transport extends Events {

    constructor(config) {
        super();
        this.pingInterval = 60000;
        this.configuration = Object.assign({}, defaults, config);
        this._connect();
    }

    _connect() {
        this.ws = new WebSocket(connectionDetails.wsPath(this.configuration), this.configuration);

        this.ws.on('open', () => {
            this.emit('open');
            this.ping();
        });

        this.ws.on('close', (code, reason) => {
            this.emit('close', code, reason);
            clearTimeout(this.timoutId);
        });

        this.ws.on('error', err => {
            this.emit('error', err);
            clearTimeout(this.timoutId);
        });

        this.ws.on('message', (data, flags) => {
            let parsed;
            try {
                parsed = JSON.parse(data);
            }
            catch (ex) {
                // continue regardless of error
            }
            this.emit('message', parsed || data, flags);
        });
    }

    ping() {
        this.ws.ping();
        this.timoutId = setTimeout(() => {
            this.ping();
        }, this.pingInterval);
    }

    send(message) {
        this.ws.send(JSON.stringify(message));
    }

    reconnect() {
        this.close();
        this._connect();
    }

    close() {
        clearTimeout(this.timoutId);
        this.ws.terminate();
        this.ws = null;
    }
}

module.exports = Transport;
