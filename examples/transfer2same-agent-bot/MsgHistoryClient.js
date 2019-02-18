const request = require('request');

const agentStatusUrl = ({msgHistDomain, accountId}) => `https://${msgHistDomain}/messaging_history/api/account/${accountId}/agent-view/status`;
const consumerConversationsUrl = ({msgHistDomain, accountId}) => `https://${msgHistDomain}/messaging_history/api/account/${accountId}/conversations/consumer/search?offset=0&limit=10`;

class MsgHistoryClient {

    constructor(options) {
        options = options || {};
        this.options = {};
        Object.assign(this.options, options);
    }

    getAgentStatus(agentId, cb) {
        const url = agentStatusUrl(this.options);
        request.post({
            url: url,
            body: {
                agentIds: [agentId]
            },
            headers: {
                'Authorization': 'Bearer ' + this.options.token
            },
            jar: this.options.jar,
            json: true
        }, (err, response, body) => {
            let authError;
            if (response && response.statusCode && response.statusCode === 401) {
                console.log(response);
                // authError = new SDKError('session unauthorized', 401);
            }

            cb(err || authError, body.agentStatusRecords[0] ? body.agentStatusRecords[0].currentStatus : null);
        });
    }

    getConsumerConversations(consumerId, cb) {
        const url = consumerConversationsUrl(this.options);
        request.post({
            url: url,
            body: {
                consumer: consumerId,
                contentToRetrieve: []
            },
            headers: {
                'Authorization': 'Bearer ' + this.options.token
            },
            jar: this.options.jar,
            json: true
        }, (err, response, body) => {
            let authError;
            if (response && response.statusCode && response.statusCode === 401) {
                console.log(response);
                // authError = new SDKError('session unauthorized', 401);
            }

            cb(err || authError, body);
        });
    }
}

module.exports = MsgHistoryClient;
