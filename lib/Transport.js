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
    wsPath: data => `wss://${data.domain}/ws_api/account/${data.accountId}/messaging/brand/${data.token}?v=${data.apiVersion}`,
};

const defaults = {
    apiVersion: 2
};

class Transport extends Events { //TODO: ping pong

    constructor(config) {
        super();
        this.configuration = Object.assign({}, defaults, config);

        this.ws = new WebSocket(connectionDetails.wsPath(this.configuration));

        this.ws.on('open', () => {
            this.emit('open');
        });

        this.ws.on('close', (code, reason) => {
            this.emit('close', code, reason);
        });

        this.ws.on('error', (err) => {
            this.emit('error', err);
        });

        this.ws.on('message', (data, flags) => {
            let parsed;
            try {
               parsed = JSON.parse(data);
            } catch (ex) {}
            this.emit('message', parsed || data, flags);
        });
    }

    send(message) {
        this.ws.send(JSON.stringify(message));
    }

}

module.exports = Transport;
