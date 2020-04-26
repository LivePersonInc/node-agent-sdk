'use strict';
const fs = require('fs');

const AgentSurveyBot = require('./AgentSurveyBot');

const conf = {
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS,
    csdsDomain: process.env.LP_CSDS
};

const surveyBot = new AgentSurveyBot(conf);

surveyBot.on('AgentSurveyBot.GetSurvey', ({conversationId, skillId}) => {
    getAndStartSurvey({conversationId, skillId}, (err, res) => {
        if (err) {
            console.log('Some error appeared during getting survey: ' + err);
        } else if (res) {
            fs.writeFile('answers.json', JSON.stringify(res), function (err) {
                if (err) throw err;
                console.log('Submit body was successfully stored!');
            });
        }
    });
});

surveyBot.on('AgentSurveyBot.DismissSurvey', ({conversationId, skillId}) => {
    getCurrentStateAndDismissSurvey({conversationId, skillId}, (err, res) => {
        if (err) {
            console.log('Some error appeared during dismiss survey: ' + err);
        } else if (res) {
            console.log('Current survey status: ' + res);
        }
    });
});

surveyBot.on('AgentSurveyBot.SubmitSurvey', ({conversationId, skillId}) => {
    let data;
    try {
        data = fs.readFileSync('answers.json');
    } catch (e) {
        console.log('Fail to get answers: ' + e);
    }
    if (data) {
        let answers = JSON.parse(data);
        getCurrentStateAndSubmitSurvey({conversationId, skillId, answers}, (err, res) => {
            if (err) {
                console.log('Error: ' + err);
                fs.unlinkSync('answers.json');
            } else {
                console.log('Survey successfully submitted. Current agent survey status ' + res);
                fs.unlinkSync('answers.json');
            }
        });
    }
});

surveyBot.on('closed', data => {
    console.log('socket closed', data);
    clearInterval(surveyBot._pingClock);
    surveyBot.reconnect(); //regenerate token for reasons of authorization (data === 4401 || data === 4407)
});

function getAndStartSurvey({conversationId, skillId}, callback) {
    surveyBot.getAgentSurvey(conversationId, skillId).then(getSurveyResponse => {
        if (getSurveyResponse.status !== 200) {
            callback('Get request returned with status code: ' + getSurveyResponse.status, null);
        } else {
            let submittedBody = buildSubmitBody(getSurveyResponse.questions, 'Hello');
            if (!submittedBody.hasNextSequence) {
                console.log('Submit body ' + JSON.stringify(submittedBody));
                callback(null, submittedBody.answers);
            } else {
                getNextSequence(submittedBody.questionId, true, getSurveyResponse.stateRevision, conversationId, skillId).then(nextSequence => {
                    if (nextSequence) {
                        let answers = submittedBody.answers.concat(nextSequence);
                        console.log('Submit body ' + JSON.stringify(answers));
                        callback(null, answers);
                    }
                });
            }
        }
    });
}

async function getNextSequence(questionId, isSequence, stateRevision, conversationId, skillId) {
    let nextSequence = await surveyBot.getNextSequence(questionId, isSequence, stateRevision, conversationId, skillId);
    if (nextSequence.status !== 200) {
        return undefined;
    } else {
        return buildShownQuestions(nextSequence.questions);
    }
}

function getCurrentStateAndSubmitSurvey({conversationId, skillId, answers}, callback) {
    surveyBot.getAgentSurvey(conversationId, skillId).then(currentState => {
        if (currentState.status === 200 && currentState.agentSurveyStatus !== 'dismissed') {
            submit(currentState.stateRevision, answers, conversationId, skillId).then(res => {
                callback(null, res);
            });
        } else {
            callback('Get current state request returned with status code: ' + currentState.status + ' agentSurvey status' + currentState.agentSurveyStatus, null);
        }
    });
}

function getCurrentStateAndDismissSurvey({conversationId, skillId}, callback) {
    surveyBot.getAgentSurvey(conversationId, skillId).then(currentState => {
        if (currentState.status === 200 && currentState.agentSurveyStatus !== 'submitted') {
            dismiss(currentState.stateRevision, conversationId, skillId).then(res => {
                callback(null, res);
            });
        } else {
            callback('Get current state request returned with status code: ' + currentState.status + currentState.agentSurveyStatus, null);
        }
    });
}

async function submit(stateRevision, answers, conversationId, skillId) {
    let submitResponse = await surveyBot.submitSurvey(stateRevision, answers, conversationId, skillId);
    if (submitResponse.status === 200) {
        return submitResponse.agentSurveyStatus;
    } else {
        return submitResponse.status;
    }
}

async function dismiss(stateRevision, conversationId, skillId) {
    let dismissResponse = await surveyBot.dismiss(conversationId, skillId, stateRevision);
    if (dismissResponse.status === 200) {
        return dismissResponse.agentSurveyStatus;
    } else {
        return dismissResponse.status;
    }
}

function buildSubmitBody(questions, text) {
    let answers = [];
    let hasNextSequence = false;
    let result = {};
    for (let i = 0; i <= questions.length - 1; i++) {
        if (questions[i].category === 'date') {
            answers[i] = {
                id: questions[i].id,
                questionStatus: 'show'
            };
        } else if (questions[i].category === 'free_text') {
            answers[i] = {
                id: questions[i].id,
                freeTextReply: text,
                questionStatus: 'answer'
            };
        } else if (questions[i].category === 'number') {
            answers[i] = {
                id: questions[i].id,
                freeTextReply: 12,
                questionStatus: 'answer'
            };
        } else {
            answers[i] = {
                id: questions[i].id,
                replyIds: [questions[i].replies[1].id],
                questionStatus: 'answer'
            };
        }
        if (questions[i].containsLogic) {
            hasNextSequence = true;
            result.questionId = questions[i].replies[1].next;
        }
    }
    result.hasNextSequence = hasNextSequence;
    result.answers = answers;
    console.log('Answers: ' + JSON.stringify(answers));
    return result;
}

function buildShownQuestions(questions) {
    let shownQuestion = [];
    for (let i = 0; i <= questions.length - 1; i++) {
        shownQuestion[i] = {
            id: questions[i].id,
            questionStatus: 'show'
        };
    }
    return shownQuestion;
}
