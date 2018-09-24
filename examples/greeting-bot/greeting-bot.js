'use strict';

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

let openConvs = {};

agent.on('connected', () => {
    console.log('connected...');
    agent.setAgentState({ availability: 'AWAY' }); // Do not route me conversations, I'll join by myself.
    agent.subscribeExConversations({
        'convState': ['OPEN'] // subscribes to all open conversation in the account.
    });
    agent._pingClock = setInterval(agent.getClock, 30000);
});

agent.on('cqm.ExConversationChangeNotification', notificationBody => {
    notificationBody.changes.forEach(change => {
        if (change.type === 'UPSERT') {
            if (!openConvs[change.result.convId]) {
                openConvs[change.result.convId] = change.result;
                if (!getParticipantInfo(change.result.conversationDetails, agent.agentId)) {
                    agent.updateConversationField({
                        'conversationId': change.result.convId,
                        'conversationField': [{
                            'field': 'ParticipantsChange',
                            'type': 'ADD',
                            'role': 'MANAGER'
                        }]
                    }, () => {
                        agent.publishEvent({
                            dialogId: change.result.convId,
                            event: {
                                type: 'ContentEvent',
                                contentType: 'text/plain',
                                message: 'welcome from bot'
                            }
                        });
                    });
                }
            }
        }
        else if (change.type === 'DELETE') {
            delete openConvs[change.result.convId];
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
