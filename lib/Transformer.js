'use strict';

function translator(body) {
    return body;
}

module.exports = {
    '.ams.aam.ExConversationChangeNotification' : (msg,agent) => {
    	msg.type = 'cqm.ExConversationChangeNotification';
    	msg.body.changes.forEach(c=>{
    		delete c.result.effectiveTTR;
    		delete c.result.lastUpdateTime;
    		delete c.result.numberOfunreadMessages;
    		let cd = c.result.conversationDetails;
    		delete cd.convId;
    		delete cd.dialogs;
    		delete cd.note;
    		delete cd.brandId;
    		delete cd.firstConversation;
    		delete cd.groupId;
    		delete cd.csatRate;
    		cd.participants = [];
    		Object.keys(cd.participantsPId).forEach(role=>
    			cd.participantsPId[role].forEach(id=>
    				cd.participants.push({id:id,role:role})));    		
    		delete cd.participantsPId;
    	});
    	return msg;
    },
    '.ams.routing.SetAgentState' : (msg,agent) => {
    	msg.body.channels = ["MESSAGING"];
    	msg.body.agentUserId = agent.agentId;
    	return msg;
    },
    '.ams.routing.SubscribeRoutingTasks' : (msg,agent) => {
    	msg.body.channelType = "MESSAGING";
    	msg.body.agentId = agent.agentId;
    	msg.body.brandId = agent.accountId;
    	return msg;
    },
    '.ams.userprofile.GetUserProfile$Response' : (msg,agent) => {
    	// TODO: format reponse as SDEs.
    	// msg.body.SDES = [];
    	// msg.body.auth_SDES = [];
    	return msg;
    },
    'ms.SubscribeMessagingEvents' : (msg,agent) => {
    	// TODO: recored subscribed conversations.
    	// agent.subscribed = agent.subscribed || {};
    	// agent.subscribed[msg.body.dialogId] = true;
    	msg.type = '.ams.ms.QueryMessages';
    	msg.body.newerThanSequence = msg.fromSeq || 0;
    	return msg;
    },
    '.ams.ms.QueryMessages$Response' : (msg,agent) => {
    	msg.body.forEach(c=>{
    		c.originatorId = c.originatorPId;
    		delete c.originatorPId;
    	});
    	agent._handleNotification({ 
    		kind: 'notification', 
    		type: 'ms.MessagingEventNotification',
    		body: { changes: msg.body } 
    	});
		delete msg.body;
		msg.type = "GenericSubscribeResponse";
		return msg;
    },
    '.ams.ms.OnlineEventDistribution' : (msg,agent) => {
    	// TODO: filter non subscribed notifications.
    	msg.type = 'ms.MessagingEventNotification';
    	msg.body.originatorId = msg.body.originatorPId;
		delete msg.body.originatorPId;
    	msg.body = { changes: [msg.body] };
        return msg;
	},
    '.ams.cm.AgentRequestConversation' : (msg,agent) => {    	
    	msg.body.channelType = "MESSAGING";    	
        return msg;
	},
    '.ams.routing.SubscribeAgentsState' : (msg,agent) => {    	
    	msg.body.brandId = agent.accountId;    	
    	msg.body.agentId = agent.agentId;    	
        return msg;
	},
    '.ams.routing.AgentStateNotification' : (msg,agent) => {    	
    	msg.type = 'routing.AgentStateNotification';
    	msg.body.changes.forEach(c=>{
    		delete c.result.agentUserId;
    	})    	
        return msg;
	}
};
