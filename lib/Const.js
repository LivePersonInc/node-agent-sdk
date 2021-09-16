'use strict';

const SERVICES = {
    MESSAGING: 'messaging',
    AUTHENTICATION: 'authentication',
    DOMAIN_NAMES: 'domainNames'
};

const ENDPOINTS = {
    LOGIN: 'login',
    REFRESH_SESSION: 'refreshSession'
};

module.exports = {
    SERVICES,
    ENDPOINTS,
    AUTH_SERVICE_CONTEXT: {
        LOGIN: `${SERVICES.AUTHENTICATION}.${ENDPOINTS.LOGIN}`,
        REFRESH_SESSION: `${SERVICES.AUTHENTICATION}.${ENDPOINTS.REFRESH_SESSION}`
    },
    EVENTS: {
        CONNECTED: 'connected',
        CLOSED: 'closed',
        NOTIFICATION: 'notification'
    },
    KINDS: {
        REQUEST: 'req',
        RESPONSE: 'resp',
        NOTIFICATION: 'notification'
    },
    REQUESTS: [
        '.GetClock',
        '.ams.cm.AgentRequestConversation',
        '.ams.aam.SubscribeExConversations',
        '.ams.aam.UnsubscribeExConversations',
        '.ams.cm.UpdateConversationField',
        '.ams.ms.PublishEvent',
        '.ams.routing.UpdateRingState',
        '.ams.routing.SubscribeRoutingTasks',
        '.ams.routing.UpdateRoutingTaskSubscription',
        '.ams.userprofile.GetUserProfile',
        '.ams.routing.SetAgentState',
        '.ams.routing.SubscribeAgentsState',
        'ms.SubscribeMessagingEvents',
        '.ams.ms.GenerateURLForDownloadFile',
        '.ams.ms.GenerateURLForUploadFile',
        '.ams.ms.token.GenerateDownloadToken'
    ]
};
