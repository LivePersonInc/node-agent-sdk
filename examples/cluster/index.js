const fs = require('fs');
const TaskSharding = require('./task-sharding.js');
const MyCoolAgent = require('./../echo/MyCoolAgent');

const zkConnStr = `${process.env.ZK_PORT_2181_TCP_ADDR}:${process.env.ZK_PORT_2181_TCP_PORT}`;
const taskSharding = new TaskSharding(zkConnStr);

const handledAgents = {};
const allAgents = JSON.parse(fs.readFileSync(process.env.BOT_CONFIG_FILE, 'utf8'));

function handleRemoveAgent(confId) {
    console.log("remove", confId);
    handledAgents[confId].dispose();
    delete handledAgents[confId];
}

function handleAddAgent(newAgentConfId, newAgentConf) {
    console.log("add", newAgentConfId);
    handledAgents[newAgentConfId] = createNewAgent(newAgentConf);
}

function createNewAgent(newAgentConf) {
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
    return newAgent;
}

const objId = agent => `${agent.accountId}-${agent.username}`;

taskSharding.on('clusterChange',(myServiceInstance, updatedHashRing) => {
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
