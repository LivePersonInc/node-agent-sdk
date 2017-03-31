const fs = require('fs');
const TaskSharding = require('task-sharding').TaskSharding;
const MyCoolAgent = require('./../agent-bot/MyCoolAgent');

const zkConnStr = `${process.env.ZK_PORT_2181_TCP_ADDR}:${process.env.ZK_PORT_2181_TCP_PORT}`;

const allAgents =
    JSON.parse(fs.readFileSync(process.env.BOT_CONFIG_FILE, 'utf8')) // read file
        .map(agentInfo => { // add id
            agentInfo.id = `${agentInfo.accountId}-${agentInfo.username}`;
            return agentInfo;
        });

const taskSharding = new TaskSharding(zkConnStr, allAgents);

taskSharding.on('taskAdded', (newAgentConf, taskInfoAdder) => {
    console.log(`add ${newAgentConf.id}`);

    // create a new Agent Connection and store it in the taskSharging store
    taskInfoAdder(createNewAgent(newAgentConf));
});

taskSharding.on('taskRemoved', (oldTaskInfo) => {
    console.log(`remove ${oldTaskInfo.conf.id}`);
    oldTaskInfo.dispose();
});

function createNewAgent(newAgentConf) {
    const newAgent = new MyCoolAgent(newAgentConf);
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
                    message: `response from ${this.conf.id}`
                }
            });
        }
    });
    newAgent.on('close', function() {
        console.log(`closed connection for ${this.conf.id}`);
    });
    return newAgent;
}
