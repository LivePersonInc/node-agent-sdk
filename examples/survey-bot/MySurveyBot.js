'use strict';

/*
 * This demo try to use most of the API calls of the mssaging agent api. It:
 *
 * 1) Listens on dialog with type 'POST_SURVEY'
 * 2) Validates the app installation id with its own
 * 3) Emit MySurveyBot.SURVEY with the consumer info
 * 4) Gets the content of the conversation
 * 5) Emit 'MySurveyBot.ContentEvent' to let the developer handle contentEvent responses
 * 6) Emit 'MySurveyBot.ACTION' to let the developer handle click responses
 * 7) Mark as 'read' the handled messages
 *
 */

const Agent = require('./../../lib/AgentSDK');

class MySurveyBot extends Agent {

    constructor(conf) {
        super(conf);

        this.conf = conf;

        this.CONTENT_NOTIFICATION = 'MySurveyBot.ContentEvent';
        this.ACTION_NOTIFICATION = 'MySurveyBot.ACTION';
        this.SURVEY = 'MySurveyBot.SURVEY';

        this.openSurveyDialogs = {};

        this.on('connected', this.onConnected.bind(this));

        // Notification on changes in the open consversation list
        this.on('cqm.ExConversationChangeNotification', this.onConversationNotification.bind(this));

        // Echo every unread consumer message and mark it as read
        this.on('ms.MessagingEventNotification', this.onMessagingNotification.bind(this));

        this.on('error', err => console.log('got an error', err));

        this.on('closed', data => {
            // For production environments ensure that you implement reconnect logic according to
            // liveperson's retry policy guidelines: https://developers.liveperson.com/guides-retry-policy.html
            console.log('socket closed', data);
            clearInterval(this._pingClock);
        });

    }

    onConnected(msg) {
        console.log('connected...', this.conf.id || '', msg);

        // tell UMS that this agent is online
        this.setAgentState({availability: 'ONLINE'});

        // subscribe to conversation updates
        this.subscribeExConversations({
            'stage': ['OPEN']
        }, (e, resp) => console.log('subscribeExConversations', this.conf.id || '', resp || e));

        // start the keep alive process
        this._pingClock = setInterval(this.getClock, 30000);
    }

    onConversationNotification(notificationBody) {
        notificationBody.changes.forEach(change => {

            // find any POST_SURVEY dialogs
            const dialogs = change.result.conversationDetails.dialogs.filter(dialog => dialog.dialogType === 'POST_SURVEY');

            // if there are no POST_SURVEY dialogs on this conversation, ignore it
            if (dialogs.length === 0) return;

            const dialog = dialogs[0];

            if (change.type === 'UPSERT') {
                this.onUpsertPostSurveyDialog(change.result, dialog);
            }

            else if (change.type === 'DELETE') {

                // ignore any that we dont know about
                if (!this.openSurveyDialogs.hasOwnProperty(dialog.dialogId)) {
                    return;
                }

                // conversation was closed or transferred
                delete this.openSurveyDialogs[dialog.dialogId];
            }
        });
    }

    onUpsertPostSurveyDialog(conversation, dialog) {

        // ignore any that we already know about
        if (this.openSurveyDialogs.hasOwnProperty(dialog.dialogId)) {
            return;
        }

        // validate that the dialog is actually yours by app installation id
        if (!dialog.metaData || dialog.metaData.appInstallId !== this.conf.appInstall) {
            console.warn(`invalid appInstallId on dialog: ${dialog.dialogId} ${dialog.metaData.appInstallId} != ${this.conf.appInstall}`)
            return;
        }

        // add to the cache of known dialogs
        this.openSurveyDialogs[dialog.dialogId] = {dialog, conversationId: conversation.convId};

        // Check if not already assigned
        if (!getParticipantInfo(conversation.conversationDetails, this.agentId) ) {
            const consumerId = conversation.conversationDetails.participants.filter(p => p.role === 'CONSUMER')[0].id;
            this.getUserProfile(consumerId, (e, profileResp) => {
                const profile = profileResp.filter(p => p.type === 'personal')[0];

                // New post survey dialog
                this.emit(this.SURVEY, {dialogId: dialog.dialogId, conversationId: conversation.convId, profile});
            });
        }

        // get the existing messages for this dialog
        this.subscribeMessagingEvents({dialogId: dialog.dialogId});
    }

    onMessagingNotification(body) {
        const respond = {};
        body.changes.forEach(c => {
            // In the current version MessagingEventNotification are recived also without subscription
            // Will be fixed in the next api version. So we have to check if this notification is handled by us.
            if (this.openSurveyDialogs[c.dialogId]) {
                // add to respond list all content event not by me
                if ((c.event.type === 'ContentEvent' || (c.event.type === 'AcceptStatusEvent' && c.event.status === 'ACTION')) &&
                    c.originatorId !== this.agentId) {
                    respond[`${body.dialogId}-${c.sequence}`] = {
                        type: c.event.type,
                        conversationId: c.conversationId,
                        dialogId: body.dialogId,
                        sequence: c.sequence,
                        message: c.event.message,
                        metadata: c.metadata
                    };
                }
                // remove from respond list all the messages that were already read
                if (c.event.type === 'AcceptStatusEvent' && c.originatorId === this.agentId) {
                    c.event.sequenceList.forEach(seq => {
                        delete respond[`${body.dialogId}-${seq}`];
                    });
                }

            }
        });

        // publish read, and echo
        Object.keys(respond).forEach(key => {
            let contentEvent = respond[key];
            this.publishEvent({
                conversationId: contentEvent.conversationId,
                dialogId: contentEvent.dialogId,
                event: {type: 'AcceptStatusEvent', status: 'READ', sequenceList: [contentEvent.sequence]}
            });
            if (contentEvent.type === 'AcceptStatusEvent') {
                this.emit(this.ACTION_NOTIFICATION, contentEvent);
            } else {
                this.emit(this.CONTENT_NOTIFICATION, contentEvent);
            }

        });
    }

}

function getParticipantInfo(convDetails, participantId) {
    return convDetails.participants.filter(p => p.id === participantId)[0];
}


module.exports = MySurveyBot;
