'use strict';

const Winston = require('winston');
const log = new Winston.Logger({
    name: 'bot_manager_log',
    transports: [new Winston.transports.Console({
        timestamp: true,
        colorize: true,
        level: process.env.loglevel || 'info'
    })]
});
const Bot = require('./bot/bot.js');

/**
 * The manager bot starts in the Away state and subscribes to all conversations
 *
 * Bot configuration is set via environment variables:
 * * LP_ACCOUNT
 * and one of:
 * * LP_USER & LP_PASSWORD
 * * LP_TOKEN & LP_USERID
 * * LP_ASSERTION
 * * LP_USER & LP_APPKEY & LP_SECRET & LP_ACCESSTOKEN & LP_ACCESSTOKENSECRET
 *
 * @type {Bot}
 */

const manager = new Bot(Bot.config, 'AWAY', true);

manager.on(Bot.const.CONNECTED, data => {
    log.info(`[manager.js] CONNECTED ${JSON.stringify(data)}`);
});

manager.on(Bot.const.ROUTING_NOTIFICATION, data => {
    log.info(`[manager.js] ROUTING_NOTIFICATION ${JSON.stringify(data)}`);
});

manager.on(Bot.const.CONVERSATION_NOTIFICATION, event => {
    log.info(`[manager.js] CONVERSATION_NOTIFICATION ${JSON.stringify(event)}`);

    // Iterate through notifications
    event.changes.forEach(change => {
        // If I'm not already a participant, join as a manager
        if (!manager.isPIDaParticipant(change.result.conversationDetails)) { manager.joinConversation(change.result.convId, 'MANAGER') }
    });
});

manager.on(Bot.const.AGENT_STATE_NOTIFICATION, event => {
    log.info(`[manager.js] AGENT_STATE_NOTIFICATION ${JSON.stringify(event)}`);
});

manager.on(Bot.const.CONTENT_NOTIFICATION, event => {
    log.info(`[manager.js] CONTENT_NOTIFICATION ${JSON.stringify(event)}`);
});

manager.on(Bot.const.SOCKET_CLOSED, event => {
    log.info(`[manager.js] SOCKET_CLOSED ${JSON.stringify(event)}`);
});

manager.on(Bot.const.ERROR, error => {
    log.error(`[manager.js] ERROR ${JSON.stringify(error)}`);
});

manager.on('error', e => log.error(`[manager.js] ${JSON.stringify(e)}`));
