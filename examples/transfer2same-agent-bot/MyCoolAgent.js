'use strict';

/*
 * This demo try to use most of the API calls of the messaging agent api. It:
 *
 * 1) Registers the agent as online
 * 2) Accepts any routing task (== ring)
 * 3) Publishes to the conversation the consumer info when it gets new conversation
 * 4) Gets the content of the conversation
 * 5) Emit 'MyCoolAgent.ContentEvnet' to let the developer handle contentEvent responses
 * 6) Mark as 'read' the handled messages
 *
 */

//const Agent = require('./../../lib/AgentSDK');
const MyCoolAgent = require('../agent-bot/MyCoolAgent');
const MsgHistoryClient = require('./MsgHistoryClient');
const t2aUtils = require('./Utils');


class MyCoolTransferAgent extends MyCoolAgent {

    constructor(conf) {
        super(conf);

        this.on(this.NEW_CONVERSATION, this.attemptTransfer.bind(this));
    }

    async getCSDSDomains() {
        return await new Promise((resolve, reject) => {
            this.csdsClient.getAll((err, domains) => {
                if (err) return reject(err);
                resolve(domains);
            })
        });
    }

    async getAgentStatus(consumerId) {
        let domains = await this.getCSDSDomains();

        return await new Promise((resolve, reject) => {
            this.conf.msgHistDomain = domains.msgHist;

            this.conf.token = this.token;

            // get consumer's best MCS conversation's agent id
            this.msgHistoryClient = new MsgHistoryClient(this.conf);

            this.msgHistoryClient.getConsumerConversations(consumerId, (err, conversations) => {
                let agentData = t2aUtils.getAgentDataForBestConversationMCS(conversations);

                // check whether the agent is available
                if (!agentData) {
                    console.warn('no agent data');
                    return;
                }

                // if agent is online transfer, and if not send a welcome message
                this.msgHistoryClient.getAgentStatus(agentData.agentId, (err, agentCurrentStatus) => {
                    if (err) return reject(err);
                    resolve({agentData, agentCurrentStatus});
                });

            });
        });

    }

    async attemptTransfer({change, conversation}) {

        let res = await this.getAgentStatus(conversation.consumerId);

        console.log(res.agentCurrentStatus);

        if (res.agentCurrentStatus === 'ONLINE') {

            this.updateConversationField({
                conversationId: change.result.convId,
                dialogId: change.result.convId,
                conversationField: [{
                    field: 'ParticipantsChange',
                    type: 'SUGGEST',
                    userId: `${this.accountId}.${res.agentData.agentId}`,
                    role: 'ASSIGNED_AGENT'
                }, {
                    field: 'ParticipantsChange',
                    type: 'REMOVE',
                    userId: this.agentId,
                    role: 'ASSIGNED_AGENT'
                }, {
                    field: 'Skill',
                    type: 'UPDATE',
                    skill: res.agentData.skillId
                }]
            }, (err, res) => {
                console.log(`msg: err - ${err}, res - ${res}`);
            });

        }

    }

}

module.exports = MyCoolTransferAgent;
