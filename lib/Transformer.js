'use strict';

module.exports = {
    '.ams.aam.ExConversationChangeNotification': (msg, agent) => {
        msg.type = 'cqm.ExConversationChangeNotification';
        msg.body.changes.forEach(change => {
            if (change && change.result) {
                delete change.result.lastUpdateTime;
                delete change.result.numberOfunreadMessages;
                let conversationDetails = change.result.conversationDetails;
                delete conversationDetails.convId;
                delete conversationDetails.note;
                delete conversationDetails.brandId;
                // delete cd.firstConversation;
                delete conversationDetails.groupId;
                delete conversationDetails.csatRate;

                Object.keys(conversationDetails.participants).forEach(role =>
                    conversationDetails.participants[role].filter(id => id === agent.__oldAgentId).forEach(() =>
                        conversationDetails.__myRole = role));

                // getMyRole is deprecated. Please use sdk.agentId
                conversationDetails.getMyRole = () => conversationDetails.__myRole;
                conversationDetails.participants = [];
                Object.keys(conversationDetails.participantsPId).forEach(role =>
                    conversationDetails.participantsPId[role].forEach(id =>
                        conversationDetails.participants.push({id: id, role: role})));

                // convert the participants id to the uuid format
                conversationDetails.dialogs.forEach(dialog => {
                    let roles = {};
                    dialog.participantsDetails.forEach(p => {
                        if (!(p.role in roles)) {
                            roles[p.role] = 0;
                        }

                        // in case in the dialog there more paricipants than in the conversation
                        let participantsPId = conversationDetails.participantsPId[p.role][roles[p.role]];
                        p.id = participantsPId ? participantsPId : p.id;
                        roles[p.role]++;
                    });
                });

                delete conversationDetails.participantsPId;
            }
        });

        return msg;
    },
    '.ams.routing.SetAgentState': (msg, agent) => {
        msg.body.channels = ['MESSAGING'];
        msg.body.agentUserId = agent.__oldAgentId;
        return msg;
    },
    '.ams.cm.UpdateConversationField': (msg, agent) => {
        msg.body.conversationField.forEach(f => {
            if (f.field === 'ParticipantsChange' && !f.userId) {
                f.userId = agent.__oldAgentId;
            }
        });
        return msg;
    },
    '.ams.routing.SubscribeRoutingTasks': (msg, agent) => {
        msg.body.channelType = 'MESSAGING';
        msg.body.agentId = agent.__oldAgentId;
        msg.body.brandId = agent.accountId;
        return msg;
    },
    '.ams.routing.RingUpdated': (msg) => {
        msg.type = 'deprecated';
        delete msg.body; // deprecated notification
        return msg;
    },
    '.ams.aam.SubscribeExConversations': (msg, agent) => {
        msg.body.agentIds = msg.body.agentIds ? msg.body.agentIds
            .map(id => id === agent.agentId ? agent.__oldAgentId : id) : undefined;
        return msg;
    },
    '.ams.routing.RoutingTaskNotification': (msg) => {
        msg.body.changes.forEach(c => {
            delete c.result.routingTaskId;
            delete c.result.assignedAgentId;
            delete c.result.brandId;
            c.result.ringsDetails.forEach(rd => {
                delete rd.brandId;
                delete rd.convId;
                delete rd.consumerId;
                delete rd.skillId;
            });
        });
        msg.type = 'routing.RoutingTaskNotification';
        return msg;
    },
    '.ams.userprofile.GetUserProfile$Response': (msg) => {
        let SDEs = [];

        let authData = msg.body.authenticatedData;
        let privateData = msg.body.privateData || {};
        let claims = msg.body.claims || {};
        if (claims && claims.lp_sdes) {
            claims.lp_sdes.forEach(sde => {
                sde.acr = msg.body.acr;
                sde.iss = claims.iss;
                SDEs.push(sde);
            });
        }
        if (authData && authData.lp_sdes) {
            authData.lp_sdes.forEach(sde => {
                sde.auth = {};
                SDEs.push(sde);
            });
        }
        let ctmrinfo = {
            type: 'ctmrinfo',
            info: {}
        };
        if (privateData.mobileNum) {
            ctmrinfo.info.imei = privateData.mobileNum;
        }
        if (privateData.userId) {
            ctmrinfo.info.customerId = privateData.userId;
        }
        if (Object.keys(ctmrinfo.info).length > 0) {
            SDEs.push(ctmrinfo);
        }

        let personalInfo = {
            type: 'personal',
            personal: {}
        };
        if (msg.body.firstName) {
            personalInfo.personal.firstname = msg.body.firstName;
        }
        if (msg.body.lastName) {
            personalInfo.personal.lastname = msg.body.lastName;
        }
        if (privateData.email || privateData.mobileNum) {
            personalInfo.personal.contacts = [{
                email: privateData.email,
                phone: privateData.mobileNum
            }];
        }
        if (Object.keys(personalInfo.personal).length > 0) {
            SDEs.push(personalInfo);
        }

        delete msg.body;
        msg.body = SDEs;
        return msg;
    },
    'ms.SubscribeMessagingEvents': (msg) => {
        // TODO: recored subscribed conversations.
        // agent.subscribed = agent.subscribed || {};
        // agent.subscribed[msg.body.dialogId] = true;
        msg.type = '.ams.ms.QueryMessages';
        msg.body.newerThanSequence = msg.body.fromSeq || 0;
        return msg;
    },
    '.ams.ms.QueryMessages$Response': (msg, agent) => {
        if (msg.body.length > 0) {
            const dialogId = msg.body[0].dialogId;
            msg.body.forEach(c => {
                c.__isMe = c.originatorId === agent.__oldAgentId;
                // isMe is deprecated. Please use sdk.agentId
                c.isMe = () => c.__isMe;
                c.originatorId = c.originatorPId;
                delete c.originatorPId;
            });
            agent._handleNotification({
                kind: 'notification',
                type: 'ms.MessagingEventNotification',
                body: {dialogId: dialogId, changes: msg.body}
            });
        }
        delete msg.body;
        msg.type = 'GenericSubscribeResponse';
        return msg;
    },
    '.ams.ms.OnlineEventDistribution': (msg, agent) => {
        // TODO: filter non subscribed notifications.
        msg.type = 'ms.MessagingEventNotification';
        msg.body.__isMe = msg.body.originatorId === agent.__oldAgentId;
        msg.body.originatorId = msg.body.originatorPId;
        delete msg.body.originatorPId;
        msg.body = {dialogId: msg.body.dialogId, changes: [msg.body]};
        const c = msg.body.changes[0];
        c.isMe = () => c.__isMe;
        return msg;
    },
    '.ams.cm.AgentRequestConversation': (msg) => {
        msg.body.channelType = 'MESSAGING';
        return msg;
    },
    '.ams.routing.SubscribeAgentsState': (msg, agent) => {
        msg.body.brandId = agent.accountId;
        msg.body.agentId = agent.__oldAgentId;
        return msg;
    },
    '.ams.routing.AgentStateNotification': (msg) => {
        msg.type = 'routing.AgentStateNotification';
        msg.body.changes.forEach(c => {
            delete c.result.agentUserId; // remove old id. Still don't have new uuid.
        });
        return msg;
    }
};
