'use strict';

const Winston = require('winston');
const log = new Winston.Logger({
    name: 'application_log',
    transports: [new Winston.transports.Console({
        timestamp: true,
        colorize: true,
        level: process.env.loglevel || 'info'
    })]
});

const config = require('/Users/mmanguno/dev/~robot_army/~modules/config/agent_config');
const Bot = require('./bot.js');

const account = '89476943';
const username = 'PassBot';

// const bender = new Bot(config[account][username]);
const bender = new Bot(config.klee);

bender.on(bender.CONST.CONNECTED, data => {
    log.info(`[index.js] CONNECTED ${JSON.stringify(data)}`)
});

bender.on(bender.CONST.ROUTING_NOTIFICATION, data => {
    log.info(`[index.js] ROUTING_NOTIFICATION ${JSON.stringify(data)}`);

    // Accept all waiting conversations
    if (data.changes.length > 0) {
        bender.acceptWaitingConversations(data);
    }
});

bender.on(bender.CONST.CONVERSATION_NOTIFICATION, event => {
    log.info(`[index.js] CONVERSATION_NOTIFICATION ${JSON.stringify(event)}`);
});

bender.on(bender.CONST.AGENT_STATE_NOTIFICATION, event => {
    log.info(`[index.js] AGENT_STATE_NOTIFICATION ${JSON.stringify(event)}`)
});

bender.on(bender.CONST.CONTENT_NOTIFICATION, event => {
    log.info(`[index.js] CONTENT_NOTIFICATION ${JSON.stringify(event)}`);

    switch (event.message.toLowerCase()) {
        case 'transfer':
            bender.sendText(event.dialogId, 'transferring you to a new skill');
            bender.transferConversation(event.dialogId, '277498214');
            break;

        case 'close':
            bender.closeConversation(event.dialogId);
            break;

        case 'time':
            bender.sendText(event.dialogId, (new Date()).toTimeString());
            break;

        case 'date':
            bender.sendText(event.dialogId, (new Date()).toDateString());
            break;

        default:
            if (event.originator.role === 'CONSUMER') {
                bender.sendText(event.dialogId, `you said ${event.message}!`)
            }
            break;
    }
});

bender.on(bender.CONST.SOCKET_CLOSED, event => {
    log.info(`[index.js] SOCKET_CLOSED ${JSON.stringify(event)}`)
});

bender.on(bender.CONST.ERROR, error => {
    log.error(`[index.js] ERROR ${JSON.stringify(error)}`)
});

bender.on('error', e => log.error(JSON.stringify(e)));