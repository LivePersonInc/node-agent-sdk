'use strict';

const Winston = require('winston');
const log = new Winston.Logger({
    name: 'bot_reader_log',
    transports: [new Winston.transports.Console({
        timestamp: true,
        colorize: true,
        level: process.env.loglevel || 'info'
    })]
});
const Bot = require('./bot/bot.js');

/**
 * The reader bot starts in the Away state and subscribes to all conversations
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

const reader = new Bot(Bot.config, 'AWAY', true);

reader.on(Bot.const.CONNECTED, data => {
    log.info(`[reader.js] CONNECTED ${JSON.stringify(data)}`);
});

reader.on(Bot.const.ROUTING_NOTIFICATION, data => {
    log.info(`[reader.js] ROUTING_NOTIFICATION ${JSON.stringify(data)}`);
});

reader.on(Bot.const.CONVERSATION_NOTIFICATION, event => {
    log.info(`[reader.js] CONVERSATION_NOTIFICATION ${JSON.stringify(event)}`);

    // Iterate through changes
    event.changes.forEach(change => {
        // If I'm not already a participant, join as a reader
        if (!reader.isPIDaParticipant(change.result.conversationDetails)) { reader.joinConversation(change.result.convId, 'READER') }
    });



});

reader.on(Bot.const.AGENT_STATE_NOTIFICATION, event => {
    log.info(`[reader.js] AGENT_STATE_NOTIFICATION ${JSON.stringify(event)}`);
});

reader.on(Bot.const.CONTENT_NOTIFICATION, event => {
    log.info(`[reader.js] CONTENT_NOTIFICATION ${JSON.stringify(event)}`);
});

reader.on(Bot.const.SOCKET_CLOSED, event => {
    log.info(`[reader.js] SOCKET_CLOSED ${JSON.stringify(event)}`);
});

reader.on(Bot.const.ERROR, error => {
    log.error(`[reader.js] ERROR ${JSON.stringify(error)}`);
});

reader.on('error', e => log.error(`[reader.js] ${JSON.stringify(e)}`));
