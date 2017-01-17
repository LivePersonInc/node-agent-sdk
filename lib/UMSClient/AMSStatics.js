if (!Object.freeze) {
    Object.prototype.freeze = function (obj) {
        return obj;
    };
}
window.lpTag = window.lpTag || {};
lpTag.AMSStatics = lpTag.AMSStatics || Object.freeze({
        memberTypes: {
            AGENT: "AGENT",
            USER: "VISITOR"
        },
        channelTypes: {
            MESSAGING: "MESSAGING",
            LIVE_CHAT: "LIVE_CHAT"
        },
        messageState: {
            PENDING: "PENDING",
            SENT: "SENT",
            ACCEPT: "ACCEPT",
            READ: "READ"
        },
        conversation: {
            states: {
                OPEN: "OPEN",
                CLOSE: "CLOSE",
                LOCKED: "LOCKED"
            },
            closeReasons: {
                AGENT: "AGENT",
                CONSUMER: "CONSUMER",
                TIMEOUT: "TIMEOUT",
                SYSTEM: "SYSTEM"
            }
        },
        dialogStates: {
            ACTIVE: "active",
            INACTIVE: "inactive",
            GONE: "gone",
            COMPOSING: "composing",
            PAUSE: "pause"
        },
        dialogActions: {
            CREATE: "CREATE",
            UPDATE: "UPDATE"
        },
        ringStates: {
            ACCEPTED: "ACCEPTED",
            CANCELLED: "CANCELLED",
            EXPIRED: "EXPIRED",
            REJECTED: "REJECTED",
            WAITING: "WAITING"
        },
        events: {
            CONVERSATION_INFO: "onConversationInfo",
            CONVERSATION_LIST: "onConversationList",
            MESSAGE: "onMessage",
            USER_INFO: "onUserInfo",
            USER_ID: "onUserId",
            CREATED: "onCreated",
            TTR: "onTTRUpdated",
            RING: "onRingUpdate",
            ROUTING: "onRoutingUpdate",
            ECHO: "onMessageEcho",
            CHAT_STATE: "onChatState",
            SESSION_INVALIDATED: "onSessionInvalidated",
            CONNECTED: "onSocketConnected",
            CLOSED: "onSocketClosed",
            QUERY_RESPONSE: "onQueryResponse",
            BRAND_PROFILE: "onBrandProfile",
            BRANDS: "onBrands",
            SUBSCRIBE_CONVERSATIONS: "onSubscribeConversations",
            SUBSCRIBE_EX_CONVERSATIONS: "onSubscribeExConversations",
            EVENT_PUBLISHED: "onEventPublished",
            CONVERSATION_NOTIFICATION: "onConversationNotification",
            EX_CONVERSATION_NOTIFICATION: "onExConversationNotification",
            EVENT_NOTIFICATION: "onEventNotification",
            SERVICE_ISSUE: "onServiceNonResponsive",
            AUTHENTICATION_ERROR: "onAuthenticationError",
            PING_SUCCESS: "onPingSuccess",
            MSG_RECEIVE : "onMessageReceive"
        },
        UMSApiEvents: {
            CONVERSATION_STATE: "onConversationState",
            CONVERSATION_LIST: "onConversationList",
            TTR: "onTTRUpdated",
            CSAT: "onCSATUpdated",
            DELETE_SUBSCRIBE_FROM_CONVERSATION: "onDeletedSubscriptionFromConversation",
            PARTICIPANT_JOINED: "onParticipantJoined",
            PARTICIPANT_LEFT: "onParticipantLeft",
            CONTENT: "onContent",
            message: "onMessage",
            messageState: "onMessageState",
            dialogState: "onDialogStateChanged"
        },
        effectiveTTRTypes: {
            normal: "NORMAL",
            urgent: "URGENT",
            custom: "CUSTOM"
        },
        messageKinds: {
            REQUEST: 'req',
            RESPONSE: 'resp',
            NOTIFICATION: 'notification'
        },
        requests: {
            GET_CLOCK: ".GetClock",
            GET_BRANDS: ".ams.brandprofile.GetBrands",
            GET_BRAND_PROFILE: ".ams.brandprofile.GetBrandProfile",
            SET_BRAND_PROFILE: ".ams.brandprofile.SetBrandProfile",
            REQUEST_CONVERSATION_AGENT: ".ams.cm.AgentRequestConversation",
            REQUEST_CONVERSATION_CONSUMER: ".ams.cm.ConsumerRequestConversation",
            SUBSCRIBE_CONVERSATIONS: ".ams.aam.SubscribeExConversations",
            UNSUBSCRIBE_CONVERSATIONS: ".ams.aam.UnsubscribeExConversations",
            UPDATE_CONVERSATIONS_SUBSCRIPTION: ".ams.aam.UpdateExConversationSubscription",
            UPDATE_CONVERSATION: ".ams.cm.UpdateConversationField",
            PUBLISH_EVENT: ".ams.ms.PublishEvent",
            QUERY_MESSAGES: ".ams.ms.QueryMessages",
            UPDATE_RING_STATE: ".ams.routing.UpdateRingState",
            SUBSCRIBE_ROUTING_TASKS: ".ams.routing.SubscribeRoutingTasks",
            UPDATE_ROUTING_SUBSCRIPTION: ".ams.routing.UpdateRoutingTaskSubscription",
            SET_USER_PROFILE: ".ams.userprofile.SetUserProfile",
            GET_USER_PROFILE: ".ams.userprofile.GetUserProfile",
            SET_AGENT_STATUS: ".ams.routing.SetAgentState",
            SUBSCRIBE_AGENT_STATUS: ".ams.routing.SubscribeAgentsState"
        },
        eventTypes: {
            CHAT_STATE: "ChatStateEvent",
            ACCEPT_STATUS: "AcceptStatusEvent",
            CONTENT: "ContentEvent"
        },
        conversationFields: {
            CSAT_RATE: "CSATRate",
            CONVERSATION_STATE: "ConversationStateField",
            DELAY: "DelayField",
            MANUAL_ETTR: "ManualETTR",
            NOTE: "Note",
            PARTICIPANTS_CHANGE: "ParticipantsChange",
            DIALOG_CHANGE: "DialogChange",
            TTR: "TTRField",
            TOPIC: "TopicField",
            SKILL: "Skill"
        },
        responses: {
            GET_CLOCK: ".GetClock$Response",
            GET_USER_PROFILE: ".ams.userprofile.GetUserProfile$Response",
            ".ams.brandprofile.GetBrands$Response": "onBrands",
            ".ams.brandprofile.GetBrandProfile$Response": "onBrandProfile",
            ".ams.aam.SubscribeExConversations$Response": "onSubscribeExConversations",
            ".ams.ms.PublishEvent$Response": "onEventPublished",
            ".ams.ms.QueryMessages$Response": "onQueryResponse"
        },
        notifications: {
            ".ams.aam.ExConversationChangeNotification": "onExConversationNotification",
            ".ams.cm.ConversationChangeNotification": "onConversationNotification",
            ".ams.ms.OnlineEventDistribution": "onEventNotification",
            ".ams.routing.RoutingTaskNotification": "onRoutingUpdate",
            ".ams.routing.RingUpdated": "onRingUpdate"
        },
        delayTypes: {
            HOLIDAY: "HOLIDAY",
            NIGHT: "NIGHT",
            WEEKEND: "WEEKEND"
        },
        authenticationErrors: [1008, 4407, 4401],
        participant: {
            roles: {
                ASSIGNED_AGENT: "ASSIGNED_AGENT",
                CONSUMER: "CONSUMER",
                MANAGER: "MANAGER",
                READER: "READER"
            }

        },
        fieldsChangeTypes: {
            ADD: "ADD",
            REMOVE: "REMOVE",
            UPDATE: "UPDATE"
        },
        contentType: {
            ContentEvent: "message",
            AcceptStatusEvent: "messageState",
            ChatStateEvent: "dialogState"
        },
        contentEvents: {
            message: "onMessage",
            messageState: "onMessageState",
            dialogState: "onDialogStateChanged"
        }
    });
