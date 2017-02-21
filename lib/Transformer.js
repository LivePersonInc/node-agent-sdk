'use strict';

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
    		Object.keys(cd.participants).forEach(role=>
    			cd.participants[role].filter(id=>id === agent.__oldAgentId).forEach(myId=>
    				cd.__myRole = role));
    		cd.getMyRole = () => cd.__myRole;
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
    	msg.body.agentUserId = agent.__oldAgentId;
    	return msg;
    },
    '.ams.cm.UpdateConversationField' : (msg,agent) => {
    	msg.body.conversationField.forEach(f=>{
    		if (f.field === 'ParticipantsChange') {
    			f.userId = agent.__oldAgentId;    			
    		}
    	});
    	return msg;
    },
    '.ams.routing.SubscribeRoutingTasks' : (msg,agent) => {
    	msg.body.channelType = "MESSAGING";
    	msg.body.agentId = agent.__oldAgentId;
    	msg.body.brandId = agent.accountId;
    	return msg;
    },
    '.ams.userprofile.GetUserProfile$Response' : (msg,agent) => {
    	let SDEs = [];
    	let authData = msg.body.authenticatedData;
    	if (authData && authData.lp_sdes) {
	    	msg.body.authenticatedData.lp_sdes.forEach(sde=>{
	    		sde.auth = {};
    			SDEs.push(sde);
	    	});    		
    	}
    	let ctmrinfo = {
    		type: "ctmrinfo",
		    info: {}
		};
    	let privateData = msg.body.privateData || {};
    	if (privateData.mobileNum) {
    		ctmrinfo.info.imei = privateData.mobileNum;
    	}
		if (Object.keys(ctmrinfo.info).length > 0) {	    			
			SDEs.push(ctmrinfo);
		}

		if (msg.body.firstname || msg.body.lastname || privateData.email || privateData.mobileNum) {
			let personalInfo = {
				type: "personal",
				personal: {}
			}
			if (msg.body.firstname) {
				personalInfo.firstname = msg.body.firstname;
			}
			if (msg.body.lastName) {
				personalInfo.firstname = msg.body.lastname;
			}		 
			if (privateData.email || privateData.mobileNum) {
				personal.contacts = [{
					email: privateData.mail,
					phone: privateData.mobileNum
				}];
			}
			if (Object.keys(personalInfo.info).length > 0) {	    			
				SDEs.push(personalInfo);
			}
		}

        delete msg.body;
        msg.body = SDEs; 
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
	    	c.__isMe = c.originatorId === agent.__oldAgentId;
    		c.isMe = () => c.__isMe;    	
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
    	msg.body.__isMe = msg.body.originatorId === agent.__oldAgentId;
    	msg.body.isMe = () => msg.body.__isMe;    	
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
    	msg.body.agentId = agent.__oldAgentId;    	
        return msg;
	},
    '.ams.routing.AgentStateNotification' : (msg,agent) => {    	
    	msg.type = 'routing.AgentStateNotification';
    	msg.body.changes.forEach(c=>{
    		delete c.result.agentUserId; // remove old id. Still don't have new uuid.
    	});    	
        return msg;
	}
};
