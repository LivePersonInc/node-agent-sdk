'use strict';

function translator(body) {
    return body;
}

module.exports = {
    // '.GetClock': msg => { console.log("myreqTrans",msg.type); return msg; },
    // '.GetClock$Response': msg => { console.log("myrespTrans",msg.type); msg.body.kuku = 3; return msg; },
    '.ams.aam.ExConversationChangeNotification' : msg => {
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
    }
};
