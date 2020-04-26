let AgentSurveyClient = require('../../lib/AgentSurveyClient');
const Agent = require('../../lib/AgentSDK');
let agentSurveyClient;
let surveyData = new Map();


class AgentSurveyBot extends Agent {
    constructor(conf) {
        super(conf);
        this.conf = conf;
        this.CONTENT_NOTIFICATION = 'AgentSurveyBot.ContentEvent';
        this.ACTION_NOTIFICATION = 'AgentSurveyBot.ACTION';
        this.GET_SURVEY = 'AgentSurveyBot.GetSurvey';
        this.SUMBIT_SURVEY = 'AgentSurveyBot.SubmitSurvey';
        this.DISMISS_SURVEY = 'AgentSurveyBot.DismissSurvey';

        this.init();
    }

    init() {
        let openConvs = {};

        this.on('connected', msg => {
            console.log('connected...', this.conf.id || '', msg);
            this.setAgentState({availability: 'ONLINE'});
            this.subscribeExConversations({
                'agentIds': [this.agentId],
                'convState': ['OPEN']
            }, (e, resp) => console.log('subscribeExConversations', this.conf.id || '', resp || e));
            this.subscribeRoutingTasks({});
            this._pingClock = setInterval(this.getClock, 30000);
        });

        // Accept any routingTask (==ring)
        this.on('routing.RoutingTaskNotification', body => {
            //init agentSurveyClient
            console.log('Agent survey client created');
            body.changes.forEach(c => {
                this.csdsClient.getAll((err, domains) => {
                    this.conf.rflDomain = domains.runtimeFormLogic;
                    this.conf.token = this.token;
                    agentSurveyClient = new AgentSurveyClient(this.conf);
                });
                if (c.type === 'UPSERT') {
                    let surveyEvent = {
                        conversationId: c.result.conversationId,
                        skillId: c.result.skillId
                    };
                    surveyData.set(c.result.conversationId, c.result.skillId);

                    c.result.ringsDetails.forEach(r => {
                        if (r.ringState === 'WAITING') {
                            this.updateRingState({
                                    'ringId': r.ringId,
                                    'ringState': 'ACCEPTED'
                                },
                                this.emit(this.GET_SURVEY, surveyEvent),
                                (e, resp) => console.log(resp));
                        }
                    });
                }
            });
        });

        this.on('cqm.ExConversationChangeNotification', notificationBody => {
            notificationBody.changes.forEach(change => {
                if (change.type === 'DELETE') {
                    let submitEvent = {
                        conversationId: change.result.convId,
                        skillId: change.result.conversationDetails.skillId
                    };
                    this.emit(this.SUMBIT_SURVEY, submitEvent);
                }
                openConvs[change.result.convId] = {};
            });
        });

        // Echo every unread consumer message and mark it as read
        this.on('ms.MessagingEventNotification', body => {
            const respond = {};
            body.changes.forEach(c => {
                // In the current version MessagingEventNotification are recived also without subscription
                // Will be fixed in the next api version. So we have to check if this notification is handled by us.
                if (openConvs[c.dialogId]) {
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
                    let surveyContent = {
                        conversationId: contentEvent.conversationId,
                        skillId: surveyData.get(contentEvent.conversationId)
                    };
                    if (contentEvent.message === 'dismiss') {
                        this.emit(this.DISMISS_SURVEY, surveyContent);
                    } else if (contentEvent.message === 'submit') {
                        this.emit(this.SUMBIT_SURVEY, surveyContent);
                    }
                }
            });
        });

        this.on('error', err => console.log('got an error', err));
        this.on('closed', data => {
            // For production environments ensure that you implement reconnect logic according to
            // liveperson's retry policy guidelines: https://developers.liveperson.com/guides-retry-policy.html
            console.log('socket closed', data);
            clearInterval(this._pingClock);
        });
    }

    async getAgentSurvey(conversationId, skillId) {
        let getResponse = await agentSurveyClient.getAgentSurveyState(conversationId, skillId);
        if (getResponse.status !== 200) {
            let result = {
                status: getResponse.status,
            };
            if (getResponse.stateRevision) {
                result.stateRevision = getResponse.data.agentSurveyContext.stateRevision;
            }
            return result;
        } else {
            console.log('>>> Survey was received');
            return {
                questions: getResponse.data.questions,
                stateRevision: getResponse.data.agentSurveyContext.stateRevision,
                agentSurveyStatus: getResponse.data.agentSurveyContext.agentSurveyStatus,
                rootId: getResponse.data.root,
                status: getResponse.status
            };
        }
    }

    async submitSurvey(stateRevision, answerArray, conversationId, skillId) {
        let submitResponse = await agentSurveyClient.submitAgentSurvey(conversationId, skillId, stateRevision, answerArray);
        if (submitResponse.status !== 200) {
            let result = {
                status: submitResponse.status
            };
            if (submitResponse.stateRevision) {
                result.stateRevision = submitResponse.stateRevision;
            }
            return result;
        } else {
            let result = {
                stateRevision: submitResponse.data.stateRevision,
                agentSurveyStatus: submitResponse.data.agentSurveyContext.agentSurveyStatus,
                status: submitResponse.status
            };
            if (submitResponse.data.questions) {
                console.log('>>> Survey was submitted. Please continue with a new sequence');
                result.questions = submitResponse.data.questions;
            }
            return result;
        }
    }

    async getNextSequence(rootSequenceId, isSequence, stateRevision, conversationId, skillId) {
        let getResponse = await agentSurveyClient.getAgentSurvey(conversationId, skillId, rootSequenceId, isSequence, stateRevision);
        let result = {
            status: getResponse.status,
            agentSurveyStatus: getResponse.data.agentSurveyContext.agentSurveyStatus
        };
        if (getResponse.data.questions) {
            result.questions = getResponse.data.questions;
        }
        return result;
    }

    async dismiss(conversationId, skillId, stateRevision) {
        let dismissResponse = await agentSurveyClient.dismissAgentSurvey(conversationId, skillId, stateRevision);
        return {
            status: dismissResponse.status,
            agentSurveyStatus: dismissResponse.data.agentSurveyStatus
        };
    }
}

module.exports = AgentSurveyBot;
