'use strict';

/**
 *
 * @param data the result that came out from the history api getting recently (last 10) consumers conversations
 */
function getAgentDataForBestConversationMCS (data) {
    let conversations = data.conversationHistoryRecords;
    let mcsArr = [];

    conversations.forEach((conversation) => {
        if (conversation && conversation.info && conversation.info.mcs) {
            mcsArr.push(
                {
                    'mcs': conversation.info.mcs,
                    'agentId': conversation.info.latestAgentId,
                    'skillId': conversation.info.latestSkillId
                });
        }
    });

    mcsArr.sort((a, b) => a.mcs - b.mcs);
    return mcsArr && mcsArr.length > 0 && mcsArr.pop();
}

module.exports = {
    getAgentDataForBestConversationMCS
};
