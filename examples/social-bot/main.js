'use strict';
require('dotenv').config();


/*
 * This demo extends MyCoolAgent with the specific reply logic:
 *
 * 1) Echo any new message from the consumer
 * 2) Close the conversation if the consumer message starts with '#close'
 *
 */

const MyCoolAgent = require('./../agent-bot/MyCoolAgent');

const conf = {
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS
};
if (process.env.LP_CSDS) {
    conf.csdsDomain = process.env.LP_CSDS;
}

const echoAgent = new MyCoolAgent(conf);

echoAgent.on(echoAgent.CONTENT_NOTIFICATION,(contentEvent) => {
    const socialEventMetadata = contentEvent.metadata.find(m => m.type === 'SocialMessagingEventData');

    if (socialEventMetadata !== undefined) {
        console.log(socialEventMetadata);
        /* IMPORTANT: If the message is from Twitter please review the below!

         To get the ID you need to base64 decode the first half of the message:
         [public/post] MsgRef:eyJ0eXBlIjogInR3ZWV0IiwgImlkIjogIjEyODA3ODY4MzQ3OTczNTA5MTciLCAidXNlcl9pZCI6ICIxMjYzMDk4ODQwNzQ1MjU5MDEwIiwgImVuY190ZXh0IjogIkNoWVJVV2hhdEhxNVJHVXJEVndhUnpnaUpoMGtJVVJkUDJPN1pTcjdrOGI2dm9xWGFjNnh0VTJNalR1NSt6OW0iLCBrZXlfaWQ9IjQ3MTEifQ==,pfV/4ArHBhWJ6HcPkWNhTs2ltUXRrOo2ZgYPKw==
         */
        try {
            const encodedMessageMetadata = contentEvent.message.split(',')[0].split('MsgRef:')[1];
            const buff = new Buffer.from(encodedMessageMetadata, 'base64');
            const messageMetadata = buff.toString('ascii');
            if (messageMetadata) {
                console.debug(`Twitter message found: ${messageMetadata}`);
            }
            /*Result:
            {'type': 'tweet', 'id': '1280786834797350917', 'user_id': '1263098840745259010', 'enc_text': 'ChYRUWhatHq5RGUrDVwaRzgiJh0kIURdP2O7ZSr7k8b6voqXac6xtU2MjTu5+z9m', key_id='4711'}

            To get the actual Twitter message call this API with the Tweet ID: https://developer.twitter.com/en/docs/twitter-api/enterprise/account-activity-api/overview
            EG: https://api.twitter.com/1.1/direct_messages/events/show.json?id=1375054015709466628
             */
        } catch (ex) {
            console.warn(`Did not find Twitter message: ${ex}`);
        }

        const channel = socialEventMetadata.channel || 'Private';
        const source = socialEventMetadata.event.source;
        const myMessage = `Bot response from: ${source}, ${channel}`;

        const myMetadata = [];
        let theMetadata = {};
        if(channel === 'Public') {
            if(source === 'Twitter') {
                theMetadata = {
                    'type': 'SocialMessagingEventData',
                    'channel': channel,
                    'replyToId': socialEventMetadata.replyToId,
                    'event': {
                        'parent': {
                            'attachmentUrl': '',
                            'timestamp': Date.now(),
                            'accountName': 'LP Social Messaging',
                            'tweetText': myMessage,
                            'tweetId': socialEventMetadata.replyToId,
                        },
                        'source': source,
                        'type': 'Reply', // {DirectMessage | Tweet | Reply | Retweet}, // for Quote use Retweet
                    },
                    'conversationState': {
                        'currentChannel': channel,
                        'dmChatId': socialEventMetadata.conversationState.dmChatId,
                    }
                };
            } else if (source === 'Facebook') {
                theMetadata = {
                    'type': 'SocialMessagingEventData',
                    'channel': channel,
                    'replyToId': socialEventMetadata.replyToId,
                    'event': {
                        'source': source,
                        'type': socialEventMetadata.event.type || 'Post', // {DirectMessage | Post | CC | CP }, // Post - User post into page community wall | CC - Comment to Comment | CP - Comment to Post
                    },
                    'conversationState': {
                        'currentChannel': channel
                    },
                };
            }
            myMetadata.push(theMetadata);
        } else {
            myMetadata.push({
                'type': 'SocialMessagingEventData',
                'channel': channel,
                'replyToId': socialEventMetadata.replyToId,
                'event': {
                    'source': source,
                    'type': 'DirectMessage'
                },
                'conversationState': {
                    'currentChannel': channel,
                    'dmChatId': socialEventMetadata.conversationState.dmChatId,
                }
            });
        }
        console.log(myMetadata);

        echoAgent.publishEvent({
            dialogId: contentEvent.dialogId,
            event: {
                type: 'ContentEvent',
                contentType: 'text/plain',
                message: myMessage,
            },
        },
        {}, myMetadata, null,
        function (resp, err) {
            if (err) {
                console.log(err);
            } else {
                console.log(resp);
            }
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
