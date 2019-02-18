'use strict';

/*
 * This demo extends MyCoolAgent with the specific reply logic: 
 * 
 * 1) Echo any new message from the consumer
 * 2) Close the conversation if the consumer message starts with '#close' 
 * 
 */

const MyCoolAgent = require('./MyCoolAgent');

const conf = {
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS
};

if (process.env.LP_CSDS) {
    conf.csdsDomain = process.env.LP_CSDS;
}

const echoAgent = new MyCoolAgent(conf);

echoAgent.on('MyCoolAgent.ContentEvnet',(contentEvent)=>{
    if (contentEvent.message.startsWith('#close')) {
        echoAgent.updateConversationField({
            conversationId: contentEvent.dialogId,
            conversationField: [{
                    field: "ConversationStateField",
                    conversationState: "CLOSE"
                }]
        });
    } else {
        echoAgent.publishEvent({
            dialogId: contentEvent.dialogId,
            event: {
                type: 'ContentEvent', 
                contentType: 'text/plain', 
                message: `echo : ${contentEvent.message}`
            }
        });
    }
});
