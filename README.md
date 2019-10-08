*Note*: For documentation on this SDK, see the LivePerson [Developers Community](https://developers.liveperson.com/messaging-agent-sdk-overview.html)

# node-agent-sdk

[![build](https://travis-ci.org/LivePersonInc/node-agent-sdk.svg?branch=master)](https://travis-ci.org/LivePersonInc/node-agent-sdk)
[![npm version](https://img.shields.io/npm/v/node-agent-sdk.svg)](https://img.shields.io/npm/v/node-agent-sdk)
[![npm downloads](https://img.shields.io/npm/dm/node-agent-sdk.svg)](https://img.shields.io/npm/dm/node-agent-sdk.svg)
[![license](https://img.shields.io/npm/l/node-agent-sdk.svg)](LICENSE)

> LivePerson Agent Messaging SDK for NodeJS

- [Deprecation Notices](#deprecation-notices)
- [Contributing](#contributing)

### Deprecation notices

##### MessagingEventNotification isMe() - *deprecated*
**This method is deprecated. Please use [agent.agentId](#agentid) instead.**

A method to understand on each change on the messaging event if it is from the agent connected right now or not.

Old way:
```javascript
agent.on('ms.MessagingEventNotification', body => {
    body.changes.forEach(change => {
        let isMe = change.isMe();
    });
});
```

New way:
```javascript
agent.on('ms.MessagingEventNotification', body => {
    body.changes.forEach(change => {
        let isMe = change.originatorMetadata.id === agent.agentId;
    });
});
```

##### ExConversationChangeNotification getMyRole() - *deprecated*
**This method is deprecated. Please use `agent.agentId` instead.**

A method to understand on each change on the conversation change notification conversation details the current agent role in the conversation or undefined if he is not participant.

Old way:
```javascript
agent.on('cqm.ExConversationChangeNotification', body => {
    body.changes.forEach(change => {
        change.result.conversationDetails.getMyRole();  
    });
});
```

New way:
```javascript
agent.on('cqm.ExConversationChangeNotification', body => {
    body.changes.forEach(change => {
        let participant = change.result.conversationDetails.participants.filter(p => p.id === agent.agentId)[0];
        let myRole = participant && participant.role;
    });
});
```

When creating a request through the request builder you should provide only the `body` to the sdk request method

### Contributing

In lieu of a formal style guide, take care to maintain the existing coding
style. Add unit tests for any new or changed functionality, lint and test your code.

- To run the tests:

   ```sh
   npm test
   ```
