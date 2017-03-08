/*
 * Bot Cluster
 * 
 * Prerequisites:
 * 1. Account with 3 agents with login names of: myagent1, myagent2, myagent3. 
 *    Same password for all of them.
 * 2. Put .env file in the current dir with:
 *    LP_ACCOUNT=__YOUR_ACCOUNT__
 *    LP_PASS=__AGENTS_PASS__
 * 
 * Then run:
 *   docker-compose up -d && docker-compose logs -f app
 *   
 * To shut down:
 *   docker-compose kill && docker-compose rm -f
 */

const zkConnStr = `${process.env.ZK_PORT_2181_TCP_ADDR}:${process.env.ZK_PORT_2181_TCP_PORT}`;

var TaskSharding = require('./task-sharding.js');
var taskSharding = new TaskSharding(zkConnStr);
const MyCoolAgent = require('./../echo/MyCoolAgent');

const handledAgents = {};
const allAgents = [{
        accountId: process.env.LP_ACCOUNT,
        username: 'myagent1',
        password: process.env.LP_PASS
    }, {
        accountId: process.env.LP_ACCOUNT,
        username: 'myagent2',
        password: process.env.LP_PASS
    }, {
        accountId: process.env.LP_ACCOUNT,
        username: 'myagent3',
        password: process.env.LP_PASS
    }];

function handleRemoveAgent(confId) {
    console.log("remove", confId);
    handledAgents[confId].transport.ws.close(1000, 'byebye');
    delete handledAgents[confId];
}

function handleAddAgent(newAgentConfId, newAgentConf) {
    console.log("add", newAgentConfId);
    const newAgent = new MyCoolAgent(newAgentConf);

    newAgent.conf = newAgentConf;
    newAgent.on('MyCoolAgent.ContentEvnet', function(contentEvent) {
        if (contentEvent.message.startsWith('#close')) {
            newAgent.updateConversationField({
                conversationId: contentEvent.dialogId,
                conversationField: [{
                        field: "ConversationStateField",
                        conversationState: "CLOSE"
                    }]
            });
        } else {
            newAgent.publishEvent({
                dialogId: contentEvent.dialogId,
                event: {
                    type: 'ContentEvent',
                    contentType: 'text/plain',
                    message: `response from ${this.conf.username}`
                }
            });
        }
    });
    newAgent.on('close', function() {
        console.log(`closed connection for ${this.conf.username}`);
    });

    handledAgents[newAgentConfId] = newAgent;
}

const objId = agent => `${agent.accountId}-${agent.username}`;

taskSharding.onClusterChange((myServiceInstance, updatedHashRing) => {
    const isOwnedByMe = agent => updatedHashRing.get(objId(agent)) === myServiceInstance.data.id;
    const myAgents = allAgents.filter(isOwnedByMe).reduce((acc, agent) => {
        acc[objId(agent)] = agent;
        return acc;
    }, {});

    Object.keys(handledAgents)
            .filter(agentConfId => !myAgents[agentConfId])
            .forEach(oldAgentConfId => {
                handleRemoveAgent(oldAgentConfId, myAgents[oldAgentConfId]);
            });

    Object.keys(myAgents)
            .filter(agentConfId => !handledAgents[agentConfId])
            .forEach(newAgentConfId => {
                handleAddAgent(newAgentConfId, myAgents[newAgentConfId]);
            });
});
