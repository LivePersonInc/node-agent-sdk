
# node-agent-sdk

[![build](https://travis-ci.org/LivePersonInc/node-agent-sdk.svg?branch=master)](https://travis-ci.org/LivePersonInc/node-agent-sdk)
[![npm version](https://img.shields.io/npm/v/node-agent-sdk.svg)](https://img.shields.io/npm/v/node-agent-sdk)
[![npm downloads](https://img.shields.io/npm/dm/node-agent-sdk.svg)](https://img.shields.io/npm/dm/node-agent-sdk.svg)
[![license](https://img.shields.io/npm/l/node-agent-sdk.svg)](LICENSE)

> LivePerson Agent Messaging SDK for NodeJS

The SDK provides a simple node JS wrapper for the [LivePerson messaging API][1].

- [Disclaimer](#disclaimer)
- [Getting Started](#getting-started)
- [Example Usage](#example-usage)
- [Example Sending Rich Content (Structured Content)](#example-sending-rich-content-structured-content)
- [API Overview](#api-overview)
  - [Agent class](#agent-class)
  - [Events](#events)
  - [Specific notifications additions](#specific-notifications-additions)
    - [MessagingEventNotification isMe() - deprecated](#messagingeventnotification-isme-deprecated)
    - [ExConversationChangeNotification getMyRole() - deprecated](#exconversationchangenotification-getmyrole-deprecated)
  - [Messaging Agent API (backend)](#messaging-agent-api-backend)
    - [reconnect()](#reconnectskiptokengeneration)
    - [dispose()](#dispose)
    - [registerRequests(arr)](#registerrequestsarr)
    - [request(type, body[, headers], callback)](#requesttype-body-headers-callback)
- [Further documentation](#further-documentation)
- [Running The Sample App](#running-the-sample-app)
- [Contributing](#contributing)

## Disclaimer
A new major version of the SDK will be released soon with a breaking change:  
The current SDK will start sending notifications once connected.  
The next version will require explicit registration.  

## Getting Started

- Install:
   
   ```sh
   npm i node-agent-sdk --save
   ```

- Run the [greeting bot example][3] (see how in [Running The Sample App][4]).


### Example Usage

```javascript
const Agent = require('node-agent-sdk').Agent;

const agent = new Agent({
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS
});

agent.on('connected', () => {
    console.log(`connected...`);

    agent.subscribeExConversations({
        'convState': ['OPEN']
    }, (err, resp) => {
        console.log('subscribed successfully', err, resp);
    });
});
```

### Example Sending Rich Content (Structured Content)
```javascript
agent.publishEvent({
    dialogId: 'MY_DIALOG_ID',
    event: {
        type: 'RichContentEvent',
        content: {
            "type": "vertical",
            "elements": [
                {
                    "type": "image",
                    "url": "http://cdn.mos.cms.futurecdn.net/vkrEdZXgwP2vFa6AEQLF7f-480-80.jpg?quality=98&strip=all",
                    "tooltip": "image tooltip",
                    "click": {
                        "actions": [
                            {
                                "type": "navigate",
                                "name": "Navigate to store via image",
                                "lo": 23423423,
                                "la": 2423423423
                            }
                        ]
                    }
                },
                {
                    "type": "text",
                    "text": "product name (Title)",
                    "tooltip": "text tooltip",
                    "style": {
                        "bold": true,
                        "size": "large"
                    }
                },
                {
                    "type": "text",
                    "text": "product name (Title)",
                    "tooltip": "text tooltip"
                },
                {
                    "type": "button",
                    "tooltip": "button tooltip",
                    "title": "Add to cart",
                    "click": {
                        "actions": [
                            {
                                "type": "link",
                                "name": "Add to cart",
                                "uri": "http://www.google.com"
                            }
                        ]
                    }
                },
                {
                    "type": "horizontal",
                    "elements": [
                        {
                            "type": "button",
                            "title": "Buy",
                            "tooltip": "Buy this product",
                            "click": {
                                "actions": [
                                    {
                                        "type": "link",
                                        "name": "Buy",
                                        "uri": "http://www.google.com"
                                    }
                                ]
                            }
                        },
                        {
                            "type": "button",
                            "title": "Find similar",
                            "tooltip": "store is the thing",
                            "click": {
                                "actions": [
                                    {
                                        "type": "link",
                                        "name": "Buy",
                                        "uri": "http://www.google.com"
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    "type": "button",
                    "tooltip": "button tooltip",
                    "title": "Publish text",
                    "click": {
                        "metadata": [
                            {
                                "type": "ExternalId",
                                "id": "MY_ACTION_ID"
                            }
                        ],
                        "actions": [
                            {
                                "type": "publishText",
                                "text": "my text"
                            }
                        ]
                    }
                },
                {
                    "type": "button",
                    "tooltip": "button tooltip",
                    "title": "Navigate",
                    "click": {
                        "actions": [
                            {
                                "type": "publishText",
                                "text": "my text"
                            },
                            {
                                "type": "navigate",
                                "name": "Navigate to store via image",
                                "lo": 23423423,
                                "la": 2423423423
                            }
                        ]
                    }
                }
            ]
        }
    }
}, null, [{type: 'ExternalId', id: 'MY_CARD_ID'}]);
```


## API Overview


### Agent class

```javascript
new Agent({
    accountId: String,
    username: String,
    password: String,
    token: String, // a bearer token instead of username and password
    userId: String, // the user id - mandatory when using token as authentication method 
    assertion: String, // a SAML assertion to be used instead of token or username and password
    appKey: String,// oauth1 keys needed (with username) to be used instead of assertion or token or username and password
    secret: String,
    accessToken: String,
    accessTokenSecret: String,
    csdsDomain: String, // override the CSDS domain if needed
    requestTimeout: Number, // default to 10000 milliseconds
    errorCheckInterval: Number, // defaults to 1000 milliseconds
    apiVersion: Number // Messaging API version - defaults to 2 (version 1 is not supported anymore)
});
```
### Authentication
The Agent Messaging SDK support the following authentication methods:
- username and password
- Barear token as `token` with user id as `userId`
- SAML assertion as `assertion`

### Events

```javascript
agent.on('connected', msg => {
    // socket is now connected to the server
});

agent.on('notification', message => {
    // listen on all notifications
});

agent.on('ms.MessagingEventNotification', body => { // specific notification type
    // listen on notifications of the MessagingEvent type
});

agent.on('GenericSubscribeResponse', (body, requestId) => { // specific response type
    // listen on notifications of the specified type, do something with the requestId
});

agent.on('closed', reason => {
    // socket is now closed
});

agent.on('error', err => {
    // some error happened
});
```

### Specific notifications additions
Some notifications support helper methods to obtain the role and to identify if the message event is from "me".

#### MessagingEventNotification isMe() - deprecated
This method is deprecated. please use `agent.agentId` instead  
A method to understand on each change on the messaging event if it is from the agent connected right now or not. 
```javascript
agent.on('ms.MessagingEventNotification', body => { 
    body.changes.forEach(change => {
        change.isMe(); 
    });
});
```

#### ExConversationChangeNotification getMyRole() - deprecated
This method is deprecated. please use `agent.agentId` instead  
A method to understand on each change on the conversation change notification conversation details the current agent role in the conversation or undefined if he is not participant.
```javascript
agent.on('cqm.ExConversationChangeNotification', body => {
    body.changes.forEach(change => {
        change.result.conversationDetails.getMyRole();  
    });
});
```

### Deprecation notice
in the `cqm.ExConversationChangeNotification` the field `firstConversation` is deprecated

### Messaging Agent API (backend)

All request types are dynamically assigned to the object on creation.
The supported API calls are a mirror of the LiveEngage Messaging Agent API - please read 
the documentation carefully for full examples.

The available API calls are:

```
getClock
agentRequestConversation
subscribeExConversations
unsubscribeExConversations
updateConversationField
publishEvent
queryMessages
updateRingState
subscribeRoutingTasks
updateRoutingTaskSubscription
getUserProfile
setAgentState
subscribeAgentsState
```

#### reconnect(skipTokenGeneration) 
Will reconnect the socket with the same configurations - will also regenerate token by default.  
Use if when socket closed unexpectedly or on token revocation.
use `skipTokenGeneration = true` if you want to skip the token generation

#### dispose() 
Will dispose of the connection and unregister internal events.  
Use it in order to clean the agent from memory.

#### registerRequests(arr)

You can dynamically add functionality to the SDK by registering more requests.
For example:

```javascript
registerRequests(['.ams.AnotherTypeOfRequest']);
// ... will register the following API:
agent.anotherTypeOfRequest({/*some data*/}, (err, response) => {
    // do something
});
```


#### request(type, body[, headers], callback)

You can call any request API functionality as follows:

```javascript
agent.request('.ams.aam.SubscribeExConversations', {
        'convState': ['OPEN']
    }, (err, resp) => {
        console.log('subscribed successfully', err, resp);
    });
```

#### agentId

You can get your agentId from the SDK using ``agent.agentId``.

### Transfer sample script 

The following code snippet will allow you to transfer an ongoing conversation to a different skill of agents 

```javascript
agent.updateConversationField({
conversationId: "THE CONVERSATION ID",
conversationField: [
                        {
                            field: "ParticipantsChange",
                            type: "REMOVE",
                            role: "ASSIGNED_AGENT"
                        },
                        {
                            field: "Skill",
                            type: "UPDATE",
                            skill: "TARGET SKILL ID"
                        }]
}, function(err) {
    if(err)....
})
```

### Further documentation

- [LivePerson messaging API][1]
- [LivePerson Chat SDK][2]

When creating a request through the request builder you should provide only the `body` to the sdk request method

## Running The Sample App

To run the [greeting bot example][3]:

- Provide the following `env` variables:
   - `LP_ACCOUNT` - Your LivePerson account ID
   - `LP_USER` - Your LivePerson agent username
   - `LP_PASS` - Your LivePerson agent password

- If you are consuming the Agent Messaging SDK as a dependency, switch to the 
package root:
   
   ```sh
   cd ./node_modules/node-agent-sdk
   ```

If you are a developer, the package root is the same as the repository root. 
There is therefore no need to change directories.

- Run with npm:
   
   ```sh
   npm start
   ```


## Contributing

In lieu of a formal styleguide, take care to maintain the existing coding 
style. Add unit tests for any new or changed functionality, lint and test your code.

- To run the tests:
   
   ```sh
   npm test
   ```

- To run the [greeting bot example][3], see [Running The Sample App][4].





[1]: https://livepersoninc.github.io/dev-hub/current/agent-int-api-reference.html
[2]: https://github.com/LivePersonInc/agent-sample-app
[3]: /examples/greeting-bot.js
[4]: #running-the-sample-app
