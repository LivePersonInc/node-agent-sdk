'use strict';

/*
 * This demo extends MyCoolAgent with the specific reply logic: 
 * 
 * 1) Echo any new message from the consumer
 * 2) Close the conversation if the consumer message starts with '#close' 
 * 
 */

const TransferAgentBot = require('./transfer-agent-bot');

const conf = {
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS
};

if (process.env.LP_CSDS) {
    conf.csdsDomain = process.env.LP_CSDS;
}

const bot = new TransferAgentBot(conf);

bot.on('MyCoolAgent.ContentEvnet',(contentEvent)=>{
    if (contentEvent.message.startsWith('#close')) {
        bot.updateConversationField({
            conversationId: contentEvent.dialogId,
            conversationField: [{
                    field: "ConversationStateField",
                    conversationState: "CLOSE"
                }]
        });
    } else {
        bot.publishEvent({
            dialogId: contentEvent.dialogId,
            event: {
                type: 'ContentEvent', 
                contentType: 'text/plain', 
                message: `echo : ${contentEvent.message}`
            }
        });
    }
});
