'use strict';

/*
 * This demo extends MySurveyBot with the specific reply logic:
 *
 * 1) Send a survey with 1 CSAT question
 * 2) Retry forever until a click on one of the available answers is made
 * 3) Sends a goodbye message and close the dialog with 'Completed' reason
 *
 */

const MySurveyBot = require('./MySurveyBot');

const conf = {
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS,
    appInstall: process.env.APP_INST
};
if (process.env.LP_CSDS) {
    conf.csdsDomain = process.env.LP_CSDS;
}

const surveyBot = new MySurveyBot(conf);

surveyBot.on('MySurveyBot.SURVEY', ({dialogId, conversationId, profile}) => {
    startSurvey({dialogId, conversationId, profile}, (err, res) => {
        // Delay for better user experience
        setTimeout(() => {
            sendCSAT({dialogId, conversationId});
        }, 1500);
    });
});

surveyBot.on('MySurveyBot.ContentEvent', (contentEvent) => {
    if (!(contentEvent.metadata && contentEvent.metadata[0] && contentEvent.metadata[0].type === 'Answer')) {
        badResponse(contentEvent);
    } //else ignore
});

surveyBot.on('MySurveyBot.ACTION', (contentEvent) => {
    if (contentEvent.metadata && contentEvent.metadata[0] && contentEvent.metadata[0].type === 'Answer') {
        goodbye({dialogId: contentEvent.dialogId, conversationId: contentEvent.conversationId, closeReason: 'Completed'});
    }
    else {
        badResponse(contentEvent);
    }
});

function badResponse(contentEvent) {
    retry({dialogId: contentEvent.dialogId, conversationId: contentEvent.conversationId}, (err, res) => {
        // Delay for better user experience
        setTimeout(() => {
            sendCSAT({dialogId: contentEvent.dialogId, conversationId: contentEvent.conversationId});
        }, 1500);
    });
    reportOnInvalidAnswer({
        dialogId: contentEvent.dialogId,
        conversationId: contentEvent.conversationId,
        sequence: contentEvent.sequence
    });
}

function reportOnInvalidAnswer({conversationId, dialogId, sequence}) {
    surveyBot.publishEvent({
        conversationId,
        dialogId,
        event: {type: 'AcceptStatusEvent', status: 'ENRICH', sequenceList: [sequence]}
    }, null, [{
        type: 'InvalidAnswer',
        questionId: '1',
        surveyId: '123',
        provider: 'External'
    }]);
}

function startSurvey({conversationId, dialogId, profile}, callback) {
    // Add myself to the dialog
    surveyBot.updateConversationField({
        conversationId,
        conversationField: [{
            dialogId,
            field: 'ParticipantsChange',
            type: 'ADD',
            role: 'AGENT'
        }]
    }, (err, response) => {
        // Add metadata regarding the survey I am in
        surveyBot.updateConversationField({
            conversationId,
            conversationField: [
                {
                    field: 'DialogChange',
                    type: 'UPDATE',
                    dialog: {
                        dialogId
                    }
                }
            ]
        }, null, [
            {
                type: 'Survey',
                id: '123',
                revision: '1.0',
                provider: 'External'
            }
        ], (err, result) => {
            // send welcome message
            surveyBot.publishEvent({
                dialogId,
                event: {
                    type: 'ContentEvent',
                    contentType: 'text/plain',
                    message: `Welcome ${profile ? profile.firstname : 'Visitor'}! I\'m Survey Bot!`,
                }
            }, callback);
        });
    });
}

function sendCSAT({dialogId, conversationId}) {
    surveyBot.publishEvent({
        conversationId,
        dialogId,
        event: {
            type: 'ContentEvent',
            contentType: 'text/plain',
            message: 'How would you rate your overall satisfaction with the service you received?',
            quickReplies: {
                itemsPerRow: 5,
                type: 'quickReplies',
                replies: [
                    {
                        type: 'button',
                        tooltip: 'Very unsatisfied tooltip',
                        title: '⭐',
                        click: {
                            metadata: [
                                {
                                    type: 'Answer',
                                    id: 'A1',
                                    surveyId: '123',
                                    questionId: '1',
                                    provider: 'External'
                                }
                            ],
                            actions: [
                                {
                                    type: 'publishText',
                                    text: '⭐'
                                }
                            ]
                        }
                    },
                    {
                        type: 'button',
                        tooltip: 'Unsatisfied tooltip',
                        title: '⭐⭐',
                        click: {
                            metadata: [
                                {
                                    type: 'Answer',
                                    id: 'A2',
                                    surveyId: '123',
                                    questionId: '1',
                                    provider: 'External'
                                }
                            ],
                            actions: [
                                {
                                    type: 'publishText',
                                    text: '⭐⭐'
                                }
                            ]
                        }
                    },
                    {
                        type: 'button',
                        tooltip: 'Neutral tooltip',
                        title: '⭐⭐⭐',
                        click: {
                            metadata: [
                                {
                                    type: 'Answer',
                                    id: 'A3',
                                    surveyId: '123',
                                    questionId: '1',
                                    provider: 'External'
                                }
                            ],
                            actions: [
                                {
                                    type: 'publishText',
                                    text: '⭐⭐⭐'
                                }
                            ]
                        }
                    },
                    {
                        type: 'button',
                        tooltip: 'Satisfied tooltip',
                        title: '⭐⭐⭐⭐',
                        click: {
                            metadata: [
                                {
                                    type: 'Answer',
                                    id: 'A4',
                                    surveyId: '123',
                                    questionId: '1',
                                    provider: 'External'
                                }
                            ],
                            actions: [
                                {
                                    type: 'publishText',
                                    text: '⭐⭐⭐⭐'
                                }
                            ]
                        }
                    },
                    {
                        type: 'button',
                        tooltip: 'Very satisfied tooltip',
                        title: '⭐⭐⭐⭐⭐',
                        click: {
                            metadata: [
                                {
                                    type: 'Answer',
                                    id: 'A5',
                                    surveyId: '123',
                                    questionId: '1',
                                    provider: 'External'
                                }
                            ],
                            actions: [
                                {
                                    type: 'publishText',
                                    text: '⭐⭐⭐⭐⭐'
                                }
                            ]
                        }
                    }
                ]
            }
        }
    }, null, [{
        type: 'Question',
        id: '1',
        surveyId: '123',
        provider: 'External',
        replies: ['A1', 'A2', 'A3', 'A4', 'A5']
    }]);
}

function retry({dialogId, conversationId}, callback) {
    surveyBot.publishEvent({
        dialogId,
        conversationId,
        event: {
            type: 'ContentEvent',
            contentType: 'text/plain',
            message: 'Sorry But I don\'t understand, Please try again...',
        }
    }, callback);
}

function goodbye({conversationId, dialogId, closeReason}) {
    surveyBot.publishEvent({
        dialogId,
        conversationId,
        event: {
            type: 'ContentEvent',
            contentType: 'text/plain',
            message: 'Thank You and Goodbye 😉',
        }
    }, (err, res) => {
        surveyBot.updateConversationField({
            conversationId,
            conversationField: [
                {
                    field: 'DialogChange',
                    type: 'UPDATE',
                    dialog: {
                        dialogId,
                        state: 'CLOSE',
                        closedBy: 'AGENT',
                        closedCause: closeReason
                    }
                }
            ]
        }, (err, res) => {
            console.log('close dialog', err, res);
        });
    });
}
