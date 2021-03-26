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

echoAgent.on(echoAgent.CONTENT_NOTIFICATION,(contentEvent)=>{
    if (contentEvent.message.startsWith('#close')) {
        echoAgent.updateConversationField({
            conversationId: contentEvent.dialogId,
            conversationField: [{
                    field: 'ConversationStateField',
                    conversationState: 'CLOSE'
                }]
        });
    }

    else if (contentEvent.message.startsWith('#test')) {
        console.log('closing WS in 5s');

        setTimeout(() => {
            console.log('closing WS');
            echoAgent.transport.ws.close();
        }, 5000);
    }

    else {
        const socialMetadata = contentEvent.metadata.find(m => m.type === 'SocialMessagingEventData');

        const myJSON = {
            'type': 'vertical',
            'elements': [{'type': 'text', 'text': 'response for public', 'alt': 'sm-piggyback'}]
        };
        const myMetadata = [{
            'type': 'SocialMessagingEventData',
            'replyToId': socialMetadata.conversationState.replyToId,
            'channel': 'Public',
            'conversationState': {'currentChannel': 'Public', 'dmChatId': socialMetadata.conversationState.dmChatId},
            'event': {
                'source': 'Facebook',
                'type': 'CP',
                'parent': {
                    'attachmentUrl': '',
                    'pageName': 'Jarrod Smith',
                    'postText': contentEvent.event.message,
                    'timestamp': Date.now()
                }
            }
        }];

        echoAgent.publishEvent({
            dialogId: contentEvent.dialogId,
            event: {
                type: 'RichContentEvent',
                content: myJSON, myMetadata
            }
        }, function (resp, err) {
            if (err) {
                console.log('my rich content log -->');
                console.log(err);
            } else {
                console.log('my rich content log -->');
                console.log(resp);
            }
        });
    }
});
