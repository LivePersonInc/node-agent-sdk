'use strict';

const SDK = require('./../lib/AgentSDK');
const accountId = 'qa55348961';
const usename = 'reemd@liveperson.com';
const password = 'lplp1234';

const sdk = new SDK({
    // csdsDomain: 'hc1n.dev.lprnd.net',
    accountId: accountId,
    username: usename,
    password: password
});

let subscriptionId;
let openConvs = {};

sdk.on('connected', (msg) => {
    console.log('connected...');
    sdk.subscribeExConversations({
        'convState': ['OPEN']
    }, (err, resp) => {
        subscriptionId = resp.subscriptionId;
        console.log('subscribed successfully', err, resp);
    });
});

sdk.on('notification', (msg) => {
    console.log('got message', msg);
    if (msg.body.subscriptionId === subscriptionId) {
        handleConversationNotification(msg.body, openConvs)
    }
});

sdk.on('error', (err) => {
    console.log('got an error', err);
});

sdk.on('closed', (data) => {
    console.log('socket closed', data);
});

function handleConversationNotification(notificationBody, openConvs) {
    notificationBody.changes.forEach(change => {
        if (change.type === 'UPSERT') {
            if (!openConvs[change.result.convId]) {
                openConvs[change.result.convId] = change.result;
                // console.log(change.result);
                if (!change.result.conversationDetails.participants.MANAGER || !change.result.conversationDetails.participants.MANAGER.includes(sdk.agentId)) {
                    sdk.updateConversationField({
                        'conversationId': change.result.convId,
                        'conversationField': [{
                            'field': 'ParticipantsChange',
                            'type': 'ADD',
                            'userId': sdk.agentId,
                            'role': 'MANAGER'
                        }]
                    }, (err, joinResp) => {
                        console.log('added');
                        sdk.queryMessages({
                            'dialogId': change.result.convId,
                            'newerThanSequence': '0'
                        }, (err, queryResp) => {
                            if (queryResp.filter(e => e.originatorPId !== change.result.conversationDetails.participantsPId.CONSUMER[0]).length == 0) {
                                console.log(`sending welcome to conv ${change.result.convId}\n`);
                                sdk.publishEvent({
                                    dialogId: change.result.convId,
                                    event: {
                                        type: 'ContentEvent',
                                        contentType: 'text/plain',
                                        message: 'welcome from bot'
                                    }
                                });
                            }
                        });
                    });
                }
            }
        } else if (change.type === 'DELETE') {
            delete openConvs[change.result.convId];
            console.log(`conversation was closed.\n`);
        }
    });
}

