const axios = require('axios');

const agentSurveyStateUrl = ({agentSurveyDomain, accountId, convId, skillId}) =>
    `https://${agentSurveyDomain}/api/account/${accountId}/forms/agent_survey/state?conv=${convId}&skill=${skillId}&v=2.0`;

const getFullAgentSurveyUrl = ({agentSurveyDomain, accountId, convId, skillId, isSequence}) =>
    `https://${agentSurveyDomain}/api/account/${accountId}/forms/agent_survey?conv=${convId}&skill=${skillId}&v=2.0&seq=${isSequence}`;

class AgentSurveyClient {
    constructor(options) {
        this.agentSurveyDomain = options.rflDomain;
        this.accountId = options.accountId;
        this.token = options.token;
    }

    async getAgentSurveyState(conversationId, skillId) {
        const url = agentSurveyStateUrl({
            agentSurveyDomain: this.agentSurveyDomain,
            accountId: this.accountId,
            convId: conversationId,
            skillId: skillId
        });
        const header = {
            'Authorization': 'Bearer ' + this.token
        };

        try {
            return await axios.get(url, {headers: header});
        } catch (error) {
            return error.response;
        }
    }

    async submitAgentSurvey(conversationId, skillId, stateRevision, submitBody) {
        const url = agentSurveyStateUrl({
            agentSurveyDomain: this.agentSurveyDomain,
            accountId: this.accountId,
            convId: conversationId,
            skillId: skillId
        });

        const header = {
            'Authorization': 'Bearer ' + this.token,
            'x-lp-state-rev': stateRevision,
            'Content-Type': 'application/json'
        };

        try {
            return await axios.post(url, submitBody, {headers: header});
        } catch (error) {
            return error.response;
        }
    }

    async dismissAgentSurvey(conversationId, skillId, stateRevision) {
        const url = agentSurveyStateUrl({
            agentSurveyDomain: this.agentSurveyDomain,
            accountId: this.accountId,
            convId: conversationId,
            skillId: skillId
        });

        const header = {
            'Authorization': 'Bearer ' + this.token,
            'x-lp-state-rev': stateRevision
        };

        try {
            return await axios.delete(url, {headers: header});
        } catch (error) {
            return error.response;
        }
    }
    async getAgentSurvey(conversationId, skillId, seqRoot, isSequence) {
        let url = getFullAgentSurveyUrl({
            agentSurveyDomain: this.agentSurveyDomain,
            accountId: this.accountId,
            convId: conversationId,
            skillId: skillId,
            isSequence: isSequence ? isSequence : true
        });

        if (seqRoot) {
            url = url + '&seqRoot=' + seqRoot;
        }
        const header = {
            'Authorization': 'Bearer ' + this.token
        };

        try {
            return await axios.get(url, {headers: header});
        } catch (error) {
            return error.response;
        }
    }
}

module.exports = AgentSurveyClient;
