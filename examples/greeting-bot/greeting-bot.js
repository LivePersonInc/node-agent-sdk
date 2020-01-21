'use strict';

const Agent = require('./../../lib/AgentSDK');

class GreetingBot extends Agent {

    constructor(conf) {
        super(conf);

        this.conf = conf;

        this.openConvs = {};

        this.on('connected', this.onConnected.bind(this));

        // Notification on changes in the open consversation list
        this.on('cqm.ExConversationChangeNotification', this.onConversationNotification.bind(this));

        this.on('error', err => console.log('got an error', err));

        this.on('closed', data => {
            // For production environments ensure that you implement reconnect logic according to
            // liveperson's retry policy guidelines: https://developers.liveperson.com/guides-retry-policy.html
            console.log('socket closed', data);
            clearInterval(this._pingClock);

            this.reconnect(); //regenerate token for reasons of authorization (data === 4401 || data === 4407)
        });

    }

    onConnected() {
        console.log('connected...');
        this.setAgentState({ availability: 'AWAY' }); // Do not route me conversations, I'll join by myself.
        this.subscribeExConversations({
            'convState': ['OPEN'] // subscribes to all open conversation in the account.
        });
        this._pingClock = setInterval(this.getClock, 30000);
    }

    onConversationNotification(notificationBody) {
        notificationBody.changes.forEach(change => {
            if (change.type === 'UPSERT') {

                // ignore if we've already joined
                if (this.openConvs[change.result.convId]) return;

                // add the conversation to the list
                this.openConvs[change.result.convId] = change.result;

                // determine if we've already joined the conversation
                let isParticipant = this.getParticipantInfo(change.result.conversationDetails, this.agentId);

                // if not, attempt a join
                if (!isParticipant) {
                    this.joinConversation(change.result);
                }
            }
            else if (change.type === 'DELETE') {
                delete this.openConvs[change.result.convId];
                console.log('conversation was closed.\n');
            }
        });
    }

    joinConversation(conversation) {
        this.updateConversationField({
            'conversationId': conversation.convId,
            'conversationField': [{
                'field': 'ParticipantsChange',
                'type': 'ADD',
                'role': 'MANAGER'
            }]
        }, () => {
            this.onConversationJoin(conversation)
        });
    }

    onConversationJoin(conversation) {
        // send a greeting
        this.publishEvent({
            dialogId: conversation.convId,
            event: {
                type: 'ContentEvent',
                contentType: 'text/plain',
                message: 'welcome from bot'
            }
        });
    }

    getParticipantInfo(convDetails, participantId) {
        return convDetails.participants.filter(p => p.id === participantId)[0];
    }

}

module.exports = GreetingBot;
