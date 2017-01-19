'use strict';

module.exports = {
    EVENTS: {
        CONNECTED: 'connected',
        SERVICE_ISSUE: 'serviceIssue',
        CLOSED: 'socketClosed',
        MSG_RECEIVE: 'message'
    },
    KINDS: {
        REQUEST: 'req',
        RESPONSE: 'resp',
        NOTIFICATION: 'notification'
    },
    REQUESTS: [
        '.GetClock',
        '.ams.brandprofile.GetBrands',
        '.ams.brandprofile.GetBrandProfile',
        '.ams.brandprofile.SetBrandProfile',
        '.ams.cm.AgentRequestConversation',
        '.ams.cm.ConsumerRequestConversation',
        '.ams.aam.SubscribeExConversations',
        '.ams.aam.UnsubscribeExConversations',
        '.ams.aam.UpdateExConversationSubscription',
        '.ams.cm.UpdateConversationField',
        '.ams.ms.PublishEvent',
        '.ams.ms.QueryMessages',
        '.ams.routing.UpdateRingState',
        '.ams.routing.SubscribeRoutingTasks',
        '.ams.routing.UpdateRoutingTaskSubscription',
        '.ams.userprofile.SetUserProfile',
        '.ams.userprofile.GetUserProfile',
        '.ams.routing.SetAgentState',
        '.ams.routing.SubscribeAgentsState'
    ]
};
