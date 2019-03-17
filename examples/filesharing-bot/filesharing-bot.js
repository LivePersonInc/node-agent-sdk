'use strict';

const fs = require('fs');
const request = require('request');
const path = require('path');
const Agent = require('./../../lib/AgentSDK');
const conf = {
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS
};


if (process.env.LP_CSDS) {
    conf.csdsDomain = process.env.LP_CSDS;
}

const agent = new Agent(conf);
const swift_domain = 'https://qa-objectstorage.dev.lprnd.net';

let openConvs = {};

agent.on('connected', () => {
    console.log('connected...');
    agent.setAgentState({availability: 'AWAY'}); // Do not route me conversations, I'll join by myself.
    agent.subscribeExConversations({
        'convState': ['OPEN'] // subscribes to all open conversation in the account.
    });
    agent._pingClock = setInterval(agent.getClock, 30000);
});

agent.on('cqm.ExConversationChangeNotification', notificationBody => {
    notificationBody.changes.forEach(change => {
        let convId = change.result.convId;
        if (change.type === 'UPSERT') {
            if (!openConvs[convId]) {
                openConvs[convId] = change.result;
                if (!getParticipantInfo(change.result.conversationDetails, agent.agentId)) {
                    agent.updateConversationField({
                        'conversationId': convId,
                        'conversationField': [{
                            'field': 'ParticipantsChange',
                            'type': 'ADD',
                            'role': 'MANAGER'
                        }]
                    }, () => {
                        shareFile(change.result.convId, 'liveperson logo');
                        publishEvent(change.result.convId, 'welcome from bot');
                    });
                }
            }
        } else if (change.type === 'DELETE') {
            delete openConvs[convId];
            console.log('conversation was closed.\n');
        }
    });
});

agent.on('error', err => {
    console.log('got an error', err);
});


agent.on('closed', data => {
    // For production environments ensure that you implement reconnect logic according to
    // liveperson's retry policy guidelines: https://developers.liveperson.com/guides-retry-policy.html
    console.log('socket closed', data);
    clearInterval(agent._pingClock);
    agent.reconnect(); //regenerate token for reasons of authorization (data === 4401 || data === 4407)
});

function getParticipantInfo(convDetails, participantId) {
    return convDetails.participants.filter(p => p.id === participantId)[0];
}

function publishEvent(convId, text) {
    agent.publishEvent({
        dialogId: convId,
        event: {
            type: 'ContentEvent',
            contentType: 'text/plain',
            message: text
        }
    }, (e, r)=>{
        if (e) console.log ('e: ' + e);
        if (r) console.log ('msg sequence: ' + r.sequence);
    });
}

function publishHostedFile(convId, relativePath, caption) {
    console.log('publishHostedFile');

    agent.publishEvent({
        dialogId: convId,
        event: {
            type: 'ContentEvent',
            contentType: 'hosted/file',
            message: {
                caption: caption,
                relativePath: relativePath,
                fileType: 'JPEG'
            }
        }
    }, (e, r)=>{
        if (e) console.log ('e: ' + e);
        if (r) console.log ('msg sequence: ' + r.sequence);
    });

    downloadFile(relativePath);
}

function shareFile(convId, caption) {
    agent.generateURLForUploadFile({
        fileSize: 5020,
        fileType: 'JPEG'
    }, (e, resp) => {
        if (e || !resp.queryParams) {
            console.log(`share file failed: ${e}, ${resp}`);
        }

        const tempUrlSig = resp.queryParams.temp_url_sig;
        const tempUrlExp = resp.queryParams.temp_url_expires;
        const relativePath = resp.relativePath;

        console.log('relative path: ' + relativePath);

        uploadFile(convId, caption, swift_domain, relativePath, `?temp_url_sig=${tempUrlSig}&temp_url_expires=${tempUrlExp}`, (err) => {
            if (err) {
                publishEvent(convId, 'error uploading');
            } else {
                publishHostedFile(convId, relativePath, 'yay!');
            }
        });
    });
}

function uploadFile(convId, caption, domain, relativePath, params, callback) {
    const file = path.resolve(__dirname, 'lp-logo.jpeg');
    const url = `${domain}${relativePath}${params}`;

    fs.createReadStream(file).pipe(request.put(url, (err, response) => {
        if (err) {
            console.log('Error uploading file', err);
            callback(err);
        } else {
            console.log('Successfully uploaded file', response.body);
            callback();
        }
    }));
}

function downloadFile(relativePath) {
    agent.generateURLForDownloadFile({
        relativePath:relativePath
    }, (e, res) => {
        if (e && e.code === 500) {
            console.log(e);
            return;
        }

        console.log('relative path: ' + res.relativePath);
        console.log('path params: ');
        console.log('expires: ' + res.queryParams.temp_url_expires);
        console.log('signature: ' + res.queryParams.temp_url_sig);
    });
}
