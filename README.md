

# node-agent-sdk

[![build](https://travis-ci.org/LivePersonInc/node-agent-sdk.svg?branch=master)](https://travis-ci.org/LivePersonInc/node-agent-sdk)
[![npm version](https://img.shields.io/npm/v/node-agent-sdk.svg)](https://img.shields.io/npm/v/node-agent-sdk)
[![npm downloads](https://img.shields.io/npm/dm/node-agent-sdk.svg)](https://img.shields.io/npm/dm/node-agent-sdk.svg)
[![license](https://img.shields.io/npm/l/node-agent-sdk.svg)](LICENSE)

> LivePerson Agent Messaging SDK for NodeJS

The SDK provides a simple node JS wrapper for the [LivePerson messaging API][1].

- [Disclaimer](#disclaimer)
- [Getting Started](#getting-started)
  - [Pre-Requisites](#pre-requisites)
  - [Install](#install)
  - [Quick Start Example](#quick-start-example)
  - [Running the Sample Apps][3]
- [API Overview](#api-overview)
  - [Agent class](#agent-class)
  - [Methods](#methods)
  - [Events](#events)
- [Deprecation Notices](#deprecation-notices)
- [Further documentation](#further-documentation)
- [Contributing](#contributing)

## Disclaimer
Currently the API behind this SDK starts sending *MessagingEventNotification*s immediately upon connection, but this subscription will exclude some notifications.

A new version of the API will be released soon in which there is no automatic subscription, and you must explicitly subscribe to these events for each conversation in order to receive them.

In order to guarantee compatibility with future versions of the API, and to ensure that no notifications are missed even with the current API version, it is highly recommended that your bot explicitly subscribe to *MessagingEventNotification*s for all relevant conversations, as demonstrated in the [Agent-Bot](/examples/agent-bot) example's [MyCoolAgent.js](/examples/agent-bot/MyCoolAgent.js).

## Getting Started

### Pre-requisites

In order to use this SDK you need a LivePerson account with the Messaging feature enabled.  You can tell whether you have Messaging by logging into LiveEngage and looking at the available sections for the main view. All accounts should have "Web Visitors", "Web History", and "All Agents". **Messaging accounts will also have "Open Connections", "All Connections", and "Messaging Agents".**

To have the Messaging feature added to your account speak with your LivePerson Account Team. If you don't have one, click [here](https://z1-a.liveper.sn/api/account/75555851/route/campaign/333765313/engagement/333765413) to chat with our Sales team.

### Install

- **Option 1 - npm install (does not include sample apps)**

   ```sh
   npm i node-agent-sdk --save
   ```

- **Option 2 - Clone this repository (includes sample apps)**

    ```sh
    git clone https://github.com/LivePersonInc/node-agent-sdk.git
    ```
    Run the [greeting bot](/examples/greeting-bot/greeting-bot.js) example (see how in [Running The Sample Apps][3]).


### Quick Start Example

#### Create `index.js`
```javascript
const Agent = require('node-agent-sdk').Agent;

const agent = new Agent({
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS
});

agent.on('connected', () => {
    console.log(`connected...`);

    // subscribe to all conversations in the account
    agent.subscribeExConversations({
        'convState': ['OPEN']
    }, (err, resp) => {
        console.log('subscribed successfully', err, resp);
    });
});

// log all conversation updates
agent.on('cqm.ExConversationChangeNotification', notificationBody => {
    console.log(JSON.stringify(notificationBody));
})
```

#### Run it:

###### Unix Shell

```sh
LP_ACCOUNT=(YourAccountNumber) LP_USER=(YourBotUsername) LP_PASS=(YourBotPassword) node index.js
```

###### Windows Shell

```sh
set LP_ACCOUNT=(YourAccountNumber)
set LP_USER=(YourBotUsername)
set LP_PASS=(YourBotPassword)
node index.js
```

### [Running the Sample Apps][3]

## API Overview

### Agent class

```javascript
new Agent({
    accountId: String,  // required
    username: String,  // required for username/password authentication and OAuth1 authentication
    password: String,  // required for username/password authentication
    appKey: String, // required for OAuth1 authentication
    secret: String, // required for OAuth1 authentication
    accessToken: String, // required for OAuth1 authentication
    accessTokenSecret: String, // required for OAuth1 authentication
    token: String, // required for token authentication
    userId: String, // required for token authentication
    assertion: String, // required for SAML authentication
    csdsDomain: String, // override the CSDS domain if needed
    requestTimeout: Number, // default to 10000 milliseconds
    errorCheckInterval: Number, // defaults to 1000 milliseconds
    apiVersion: Number // Messaging API version - defaults to 2 (version 1 is not supported anymore)
});
```
#### Authentication
The Agent Messaging SDK support the following authentication methods:
- Username and password as `username` and `password`
- Bearer token as `token` with user id as `userId`
- SAML assertion as `assertion`
- OAuth1 with `username`, `appkey`, `secret`, `accessToken`, and `accessTokenSecret`

#### agentId

You can get your agentId from the SDK using `agent.agentId`.

### Methods

- [subscribeExConversations](#subscribeexconversations)
- [subscribeAgentsState](#subscribeagentsstate)
- [subscribeRoutingTasks](#subscriberoutingtasks)
- [subscribeMessagingEvents](#subscribemessagingevents)
- [setAgentState](#setagentstate)
- [getClock](#getclock)
- [getUserProfile](#getuserprofile)
- [updateRingState](#updateringstate)
- [updateConversationField](#updateconversationfield)
- [generateURLForDownloadFile](#generateurlfordownloadfile)
- [generateURLForUploadFile](#generateurlforuploadfile)
- [publishEvent](#publishevent)
- [reconnect](#reconnect)
- [dispose](#dispose)

#### General request signature
All requests has the same method signature:
```javascript
agent.someRequest(body, headers, metadata, encodedMetadata, callback);
```
Where all except body are optional and callback can be placed instead off `headers`, `metadata` and `encodedMetadata`.

#### subscribeExConversations
This method is used to create a subscription for conversation updates. You can subscribe to all events, or to only those events pertaining to a specific agent or agents.

```javascript
agent.subscribeExConversations({
    'convState': ['OPEN']
    ,'agentIds': [agent.agentId] // remove this line to subscribe to all conversations instead of just the bot's conversations
}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

Success response:

`{"subScriptionId":"aaaabbbb-cccc-1234-56d7-a1b2c3d4e5f6"}`

#### subscribeAgentsState
This method is used to create a subscription for Agent State updates. An event will be received whenever the bot user's state is updated.

```javascript
agent.subscribeAgentsState({}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

Success response:

`{"subScriptionId":"aaaabbbb-cccc-1234-56d7-a1b2c3d4e5f6"}`

#### subscribeRoutingTasks
This method is used to create a subscription for Routing Tasks. An event will be received whenever new conversation(s) are routed to the agent. In response your bot can 'accept' the new conversation, as described below in the updateRingState method.

```javascript
agent.subscribeRoutingTasks({}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

Success response:

`{"subScriptionId":"aaaabbbb-cccc-1234-56d7-a1b2c3d4e5f6"}`

#### subscribeMessagingEvents
This method is used to create a subscription for all of the Messaging Events in a particular conversation. This includes messages sent by any participant in the conversation, as well as "agent is typing" or "visitor is typing" notifications and notifications when a message has been read by a participant.

```javascript
agent.subscribeMessagingEvents({dialogId: 'some conversation id'}, (e) => {if (e) console.error(e)});
```

This method returns no data when the subscription is successful.

#### setAgentState
This method is used to set your agent's state to one of: `'ONLINE'` (can receive routing tasks for incoming conversations), `'OCCUPIED'` (can receive routing tasks for incoming transfers only), or `'AWAY'` (cannot receive routing tasks)

```javascript
agent.setAgentState({
    'availability': 'ONLINE'
}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

Success response:

`"Agent state updated successfully"`

#### getClock
This method is used to synchronize your client clock with the messaging server's clock. It can also be used as a periodic keep-alive request, to ensure that your bot's connection is maintained even in periods of low activity.

```javascript
agent.getClock({}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

Success response:

`{"currentTime":1513813587308}`

#### getUserProfile
This method is used to get a consumer's profile data

```javascript
agent.getUserProfile(consumerId, (e, profile) => {
    if (e) { console.error(e) }
    console.log(profile)
});
```

The consumerId parameter can be retrieved from the array of participants that accompanies a cqm.ExConversationChangeNotification event as follows:

```javascript
agent.on('cqm.ExConversationChangeNotification', body => {
    body.changes.forEach(change => {
        agent.getUserProfile(change.result.conversationDetails.participants.filter(p => p.role === 'CONSUMER'[0].id), callback)
    })
})
```

Success response:

`[{"type":"personal","personal":{"firstname":"Michael","lastname":"Bolton"}}]`

#### updateRingState
This method is used to update the ring state of an incoming conversation--In other words, to accept the conversation

```javascript
agent.updateRingState({
    "ringId": "someRingId",  // Ring ID received from the routing.routingTaskNotification event
    "ringState": "ACCEPTED"
}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

Success response:

`"Ring state updated successfully"`

#### updateConversationField
This method is used to update some field of a conversation object, such as when joining a conversation as a 'MANAGER' or during a transfer when the `SKILL` is changed and the `ASSIGNED_AGENT` is removed

```javascript
agent.updateConversationField({
    'conversationId': 'conversationId/dialogId',
    'conversationField': [{
        'field': '',
        'type': '',
        '' : ''
    }]
}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

##### Example: Join conversation as manager
```javascript
agent.updateConversationField({
    'conversationId': 'conversationId/dialogId',
    'conversationField': [{
         'field': 'ParticipantsChange',
         'type': 'ADD',
         'role': 'MANAGER'
     }]
}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

Success response:

`"OK Agent added successfully"`

##### Example: Close a conversation
```javascript
agent.updateConversationField({
        conversationId: conversationId/dialogId,
        conversationField: [{
            field: 'ConversationStateField',
            conversationState: 'CLOSE'
        }]
    });
 ```

##### Example: Transfer conversation to a new skill
```javascript
agent.updateConversationField({
'conversationId': 'conversationId/dialogId',
    'conversationField': [
        {
            'field': 'ParticipantsChange',
            'type': 'REMOVE',
            'role': 'ASSIGNED_AGENT'
        },
        {
            'field': 'Skill',
            'type': 'UPDATE',
            'skill': targetSkillId
        }
    ]
}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

##### Example: Transfer conversation to a new agent
```javascript
agent.updateConversationField({
'conversationId': 'conversationId/dialogId',
    'conversationField': [
        {
            'field': 'ParticipantsChange',
            'type': 'REMOVE',
            'role': 'ASSIGNED_AGENT'
        },{
            'field': 'ParticipantsChange',
            'type': 'SUGGEST',
            'userId': '<suggested agent id>'
            'role': 'ASSIGNED_AGENT'
        },{
            'field': 'Skill',
            'type': 'UPDATE',
            'skill': targetSkillId
        }
    ]
}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

Success response:

`"OK Agent removed successfully"`

#### generateURLForDownloadFile
In order the generate url for download the file was published by one of the participants, use the following:
```javascript
agent.generateURLForDownloadFile({
    relativePath:'<path>'
}, (e, res) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

#### generateURLForUploadFile
In order the generate url for upload a file for sharing with other participants, use the following:
```javascript
agent.generateURLForUploadFile({
    fileSize: 5020,
    fileType: 'JPEG'
}, (e, resp) => {
    if (e) { console.error(e) }
    console.log(resp)
});
```

#### publishEvent
This method is used to publish an event to a conversation.
```javascript
agent.publishEvent({
    dialogId: 'conversationId/dialogId',
    event: {}
});
```

##### Example: Sending Text
```javascript
agent.publishEvent({
	dialogId: 'MY_DIALOG_ID',
	event: {
		type: 'ContentEvent',
		contentType: 'text/plain',
		message: 'hello world!'
	}
});
```

Success response:
`{"sequence":17}`

##### Example: Set Agent Typing Notification
```javascript
agent.publishEvent({
    dialogId: 'MY_DIALOG_ID',
    event: {
        type: 'ChatStateEvent',
        chatState: 'COMPOSING'
    }
})
```

##### Example: Clear Agent Typing Notification
```javascript
agent.publishEvent({
    dialogId: 'MY_DIALOG_ID',
    event: {
        type: 'ChatStateEvent',
        chatState: 'ACTIVE'
    }
})
```

##### Example: Share An Uploaded File
```javascript
agent.publishEvent({
    dialogId: '<the id of the dialog>',
    event: {
        type: 'ContentEvent',
        contentType: 'hosted/file',
        message: {
            caption: '<some test here>',
            relativePath: '<relative path got from the generateUrlForUploadFile>',
            fileType: '<the file type>'
        }
    }
}, (e, r)=>{
    if (e) console.log ('e: ' + e);
    if (r) console.log ('msg sequence: ' + r.sequence);
});
```

##### Example: Sending Text with Quick Replies

For more examples see [Quick Replies Documentation](https://developers.liveperson.com/rich-messaging-quick-replies-overview.html)
```javascript
agent.publishEvent({
    dialogId: 'MY_DIALOG_ID',
    event: {
        type: 'ContentEvent',
        contentType: 'text/plain',
        message: 'hello world!',
        quickReplies: {
            "type": "quickReplies",
            "itemsPerRow": 8,
            "replies": [
                {
                    "type": "button",
                    "tooltip": "Yes!",
                    "title": "Yes",
                    "click": {
                        "actions": [
                            {
                                "type": "publishText",
                                "text": "yep"
                            }
                        ],
                        "metadata": [
                            {
                                "type": "ExternalId",
                                "id": "Yes-1234"
                            }
                        ]
                    }
                },
                {
                    "type": "button",
                    "tooltip": "No!",
                    "title": "No!",
                    "click": {
                        "actions": [
                            {
                                "type": "publishText",
                                "text": "No!"
                            }
                        ],
                        "metadata": [
                            {
                                "type": "ExternalId",
                                "id": "No-4321"
                            }
                        ]
                    }
                }
            ]
        }
    }
});
```

Success response:
`{"sequence":21}`

##### Example: Sending Rich Content (Structured Content)

*Note that if your structured content card contains images (like the one below) the image must be on an https domain and that domain must be whitelisted on your account. Ask your LivePerson representative to help you with that.*

For more examples see [Structured Content Templates](https://developers.liveperson.com/structured-content-templates.html)
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
								"lo": -73.99852590,
								"la": 40.7562724
							}
						]
					}
				},
				{
					"type": "text",
					"text": "Product Name",
					"tooltip": "text tooltip",
					"style": {
						"bold": true,
						"size": "large"
					}
				},
				{
					"type": "text",
					"text": "Product description",
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
				}
			]
		}
	}
}, null, [{type: 'ExternalId', id: 'MY_CARD_ID'}]);  // ExternalId is how this card will be referred to in reports
```

Success response:
`{"sequence":29}`

##### Example: Sending Rich Content (Structured Content) with Quick Replies

*Note that if your structured content card contains images (like the one below) the image must be on an https domain and that domain must be whitelisted on your account. Ask your LivePerson representative to help you with that.*

For more examples using Structured Content see [Structured Content Templates](https://developers.liveperson.com/structured-content-templates.html)
For more examples using Quick Replies see [Quick Replies Documentation](https://developers.liveperson.com/rich-messaging-quick-replies-overview.html)
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
                                "lo": -73.99852590,
                                "la": 40.7562724
                            }
                        ]
                    }
                },
                {
                    "type": "text",
                    "text": "Product Name",
                    "tooltip": "text tooltip",
                    "style": {
                        "bold": true,
                        "size": "large"
                    }
                },
                {
                    "type": "text",
                    "text": "Product description",
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
                }
            ]
        },
        quickReplies: {
            "type": "quickReplies",
            "itemsPerRow": 8,
            "replies": [
                {
                    "type": "button",
                    "tooltip": "Yes!",
                    "title": "Yes",
                    "click": {
                        "actions": [
                            {
                                "type": "publishText",
                                "text": "yep"
                            }
                        ],
                        "metadata": [
                            {
                                "type": "ExternalId",
                                "id": "Yes-1234"
                            }
                        ]
                    }
                },
                {
                    "type": "button",
                    "tooltip": "No!",
                    "title": "No!",
                    "click": {
                        "actions": [
                            {
                                "type": "publishText",
                                "text": "No!"
                            }
                        ],
                        "metadata": [
                            {
                                "type": "ExternalId",
                                "id": "No-4321"
                            }
                        ]
                    }
                }
            ]
        }
    }
}, null, [{type: 'ExternalId', id: 'MY_CARD_ID'}]);  // ExternalId is how this card will be referred to in reports
```

Success response:
`{"sequence":32}`

#### reconnect(skipTokenGeneration)
**Make sure that you implement reconnect logic according to [liveperson's retry policy guidelines](https://developers.liveperson.com/guides-retry-policy.html)**

Will reconnect the socket with the same configurations - will also regenerate token by default.  Use if socket closes unexpectedly or on token revocation.

Use `skipTokenGeneration = true` if you want to skip the generation of a new token.

Call `reconnect` on `error` with code `401`.

**Note**: When the `reconnect` method fails to re-establish a connection with LiveEngage, a `closed` and `error` events will fire. Unless these events are handled, multiple instances of a reconnection mechanism will be triggered. See our (retry policy)[https://developers.liveperson.com/retry-and-keepalive-best-practices-overview.html] for more information on how we recommend you handle a retry mechanism.

#### dispose()
Will dispose of the connection and unregister internal events.

Use it in order to clean the agent from memory.

### Events

- [connected](#connected)
- [notification](#notification)
- [routing.RoutingTaskNotification](#routingroutingtasknotification)
- [routing.AgentStateNotification](#routingagentstatenotification)
- [cqm.ExConversationChangeNotification](#cqmexconversationchangenotification)
- [ms.MessagingEventNotification](#msmessagingeventnotification)
- [closed](#closed)
- [error](#error)

These are events emitted by the SDK which you can listen to and react to.

#### connected
This event occurs when you establish a websocket connection to the server. This is where you should [set your agent's initial state](#setagentstate), [subscribe to conversation changes](#subscribeexconversations), [subscribe to routing notifications](#subscriberoutingtasks), and perform general initialization tasks.

Sample code:
```javascript
agent.on('connected', message => {
    // socket connected
});
```

Example payload:

```json
{"connected":true,"ts":1516999337528}
```

#### routing.RoutingTaskNotification
This event occurs when new conversations are presented to the bot by LivePerson's routing mechanism. This is equivalent to a new conversation "ringing" in a human agent's workspace. In response to this event you should have your bot [updateRingState](#updateringstate) for each ring.

Sample code:
```javascript
agent.on('routing.RoutingTaskNotification', body => {
    body.changes.forEach(change => {
        if (change.type === 'UPSERT') {
            change.result.ringsDetails.forEach(ring => {
                if (ring.ringState === 'WAITING') {
                    this.updateRingState({
                        'ringId': ring.ringId,
                        'ringState': 'ACCEPTED'
                    }, (e, resp) => {
                        if (e) { log.error(`[bot.js] acceptWaitingConversations ${JSON.stringify(e)}`) }
                        else { log.info(`[bot.js] acceptWaitingConversations: Joined conversation ${JSON.stringify(change.result.conversationId)}, ${JSON.stringify(resp)}`) }
                    });
                }
            });
        }
    });
});
```

Example payload:
```json
{
  "subscriptionId": "be13bab4-ec92-472f-b840-798b4cb476a4",
  "changes": [
    {
      "type": "UPSERT",
      "result": {
        "taskCompleted": true,
        "conversationId": "41d33e78-9701-4edd-a569-01dfb6c0f40a",
        "consumerId": "d51ce914-97ad-4544-a686-8335b61dcdf3",
        "skillId": "-1",
        "ringsDetails": [
          {
            "ringId": "41d33e78-9701-4edd-a569-01dfb6c0f40a_89476943_1517000827442",
            "ringExpirationTs": 1517000899442,
            "ringState": "ACCEPTED",
            "weight": 1517004427244,
            "ringExpiration": 72000
          }
        ]
      }
    }
  ]
}
```

#### routing.AgentStateNotification
This event occurs when your agent's state changes (usually as a result of using [setAgentState()](#setagentstate))

Sample code:
```javascript
agent.on('routing.AgentStateNotification', body => {
    // TODO: stuff here
})
```

Example payload:
```json
{
  "subscriptionId": "5ebe7fcd-c59e-4fd2-a622-ec412a01a549",
  "changes": [
    {
      "type": "UPSERT",
      "result": {
        "channels": [
          "MESSAGING"
        ],
        "availability": "ONLINE",
        "description": ""
      }
    }
  ]
}
```

#### cqm.ExConversationChangeNotification
This event occurs when a conversation that your subscription qualifies for* is updated in any way. If you passed no agentIds array when calling [subscribExConversations()](#subscribeexconversations), and you have the necessary permissions to see all agents' conversations, you will receive these events for all conversations. If you passed in your own agentId with `subscribeExConversations` you will only receive updates for conversations that you are a participant in (such as conversations that you have just accepted via a [routing.routingTaskNotification](#routingroutingtasknotification), 
this won't include converastions that you are not the assigned agent).

**Important** Due to a race condition in the service that serves these notifications they may not always contain the lastContentEventNotification attribute. For this reason you cannot rely on them to consume all of the messages in the conversation, and you should use this event to call [subscribeMessagingEvents()](#subscribemessagingevents) for conversations you want to follow.  You should keep a list of conversations you are handling in order to prevent attempting to subscribe to the same conversation repeatedly.

##### Subscribing to Change Notifications with Transfer to Agent

After the transfer-to-agent API call,  the UMS will check the validity of the request and after doing internals it will notify agents with connection version 2.1  of the change. This change will be communicated via the `ExConversationChangeNotification` whose format has been changed to accomodate this new feature. 

The change in the format is in the participants of the dialog, which is where we added the suggested agent, as follows:

* A new ‘state’ field has been added to the items in ‘participantsDetails’ array.

* The state can be either ‘ACTIVE’ or ‘SUGGESTED’.

* When the ‘role’ is set to ‘ASSIGNED_AGENT’, this value differentiates between agents which have been ‘SUGGESTED’ (that is, a conversation was transferred directly to them but might not yet have been accepted) and ‘ACTIVE’ agents, which have actually accepted the incoming conversation (that is, the conversation has been transferred to them and they have accepted it).

**Note**: If your existing code uses the existing property ‘role’ to check if the agent has been assigned to the conversation ('role': 'ASSIGNED_AGENT') and doesn’t check the new ‘state’ property, you might get a false positive. That is, a conversation was transferred to an agent (so the ‘role’ of that agent is now ‘ASSIGNED_AGENT’) but the agent has not yet accepted this conversation (so their ‘type’ is now ‘SUGGESTED’ instead of ‘ACTIVE’).

In this case, you will need to add some function into your code which checks both the ‘role’ and ‘state’ properties.

For other role types, the state field will always be populated with ‘ACTIVE’. 

The API should be used on the new version published (2.1). In case the transfer-to-agent call is triggered from version 2.0 with the described format, the transfer will occur but the one who triggered won't get the notification,  since notification is available only from the new version!


Sample code:
```javascript
agent.on('cqm.ExConversationChangeNotification', body => {
    body.changes.forEach(change => {
        if (change.type === 'UPSERT' && !inMyConversationList(change.result.convId)) {
            addToMyConversationList(change.result.convId);
            agent.subscribeMessagingEvents({dialogId: change.result.convId}, e => {if (e) console.error(e)})
        } else if (change.type === 'DELETE') {
            removeFromMyConversationList(change.result.convId);
        }
    })
})
```

Example payload:
```json
{
  "subscriptionId": "e7f5ee81-4556-406c-8c72-94c69dd68fad",
  "changes": [
    {
      "type": "UPSERT",
      "result": {
        "convId": "220d3639-ae23-4c90-83e8-455e3bb2cf13",
        "conversationDetails": {
          "skillId": "-1",
          "participants": [
            {
              "id": "d51ce914-97ad-4544-a686-8335b61dcdf3",
              "role": "CONSUMER"
            },
            {
              "id": "1a41233d-1d2c-5158-bacc-ee0f2d384888",
              "role": "MANAGER"
            },
            {
              "id": "393c6873-756d-54af-86e1-8795d57eba14",
              "role": "ASSIGNED_AGENT"
            }
          ],
          "state": "OPEN",
          "startTs": 1516999063585,
          "metaDataLastUpdateTs": 1516999196220,
          "firstConversation": false,
          "ttr": {
            "ttrType": "NORMAL",
            "value": 3600
          },
          "context": {
            "type": "MobileAppContext",
            "lang": "en-US",
            "clientProperties": {
              "type": ".ClientProperties",
              "appId": "com.liveperson.mmanguno.upgradetest23_30",
              "ipAddress": "172.26.138.125",
              "deviceFamily": "MOBILE",
              "os": "ANDROID",
              "osVersion": "27",
              "integration": "MOBILE_SDK",
              "integrationVersion": "3.0.0.0",
              "timeZone": "America/New_York",
              "features": [
                "PHOTO_SHARING",
                "CO_APP",
                "AUTO_MESSAGES",
                "RICH_CONTENT",
                "SECURE_FORMS"
              ]
            }
          },
          "__myRole": "ASSIGNED_AGENT"
        },
        "lastContentEventNotification": {
          "sequence": 29,
          "originatorClientProperties": {
            "type": ".ClientProperties",
            "ipAddress": "172.26.138.214"
          },
          "originatorId": "89476943.282467514",
          "originatorPId": "393c6873-756d-54af-86e1-8795d57eba14",
          "originatorMetadata": {
            "id": "393c6873-756d-54af-86e1-8795d57eba14",
            "role": "ASSIGNED_AGENT",
            "clientProperties": {
              "type": ".ClientProperties",
              "ipAddress": "172.26.138.214"
            }
          },
          "serverTimestamp": 1516999340978,
          "event": {
            "type": "RichContentEvent",
            "content": {
              "type": "vertical",
              "elements": [
                {
                  "type": "text",
                  "text": "Product Name",
                  "tooltip": "text tooltip",
                  "style": {
                    "bold": true,
                    "size": "large"
                  }
                },
                {
                  "type": "text",
                  "text": "Product description",
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
                }
              ]
            }
          },
          "dialogId": "220d3639-ae23-4c90-83e8-455e3bb2cf13"
        }
      }
    }
  ]
}
```

#### ms.MessagingEventNotification
This event occurs whenever there is a new message in a conversation, a message is marked as read, a participant starts typing or stops typing, or the consumer opens/closes their websocket connection (such as when they enter or leave the messaging window in a LivePerson Mobile SDK implementation).  Use this to consume messages, mark them as read, and react to them as you see fit.

Sample code:
```javascript
agent.on('ms.MessagingEventNotification', body => { // specific notification type
    // TODO: stuff here
});
```

###### Example payloads
New message (sent by the agent in this case)
```json
{
  "dialogId": "41d33e78-9701-4edd-a569-01dfb6c0f40a",
  "changes": [
    {
      "sequence": 10,
      "originatorClientProperties": {
        "type": ".ClientProperties",
        "ipAddress": "172.26.138.213"
      },
      "originatorId": "393c6873-756d-54af-86e1-8795d57eba14",
      "originatorMetadata": {
        "id": "393c6873-756d-54af-86e1-8795d57eba14",
        "role": "ASSIGNED_AGENT",
        "clientProperties": {
          "type": ".ClientProperties",
          "ipAddress": "172.26.138.213"
        }
      },
      "serverTimestamp": 1517002351775,
      "event": {
        "type": "ContentEvent",
        "message": "16:32:31 GMT-0500 (EST)",
        "contentType": "text/plain"
      },
      "dialogId": "41d33e78-9701-4edd-a569-01dfb6c0f40a",
      "__isMe": true
    }
  ]
}
```

Message(s) read
```json
{
  "sequence": 9,
  "originatorClientProperties": {
    "type": ".ClientProperties",
    "ipAddress": "172.26.138.213"
  },
  "originatorId": "393c6873-756d-54af-86e1-8795d57eba14",
  "originatorMetadata": {
    "id": "393c6873-756d-54af-86e1-8795d57eba14",
    "role": "ASSIGNED_AGENT",
    "clientProperties": {
      "type": ".ClientProperties",
      "ipAddress": "172.26.138.213"
    }
  },
  "serverTimestamp": 1517002351770,
  "event": {
    "type": "AcceptStatusEvent",
    "status": "READ",
    "sequenceList": [
      8
    ]
  },
  "dialogId": "41d33e78-9701-4edd-a569-01dfb6c0f40a",
  "__isMe": true
}
```

Consumer is typing
```json
{
  "originatorClientProperties": {
    "type": ".ClientProperties",
    "appId": "com.liveperson.mmanguno.upgradetest23_30",
    "ipAddress": "172.26.138.214",
    "deviceFamily": "MOBILE",
    "os": "ANDROID",
    "osVersion": "27",
    "integration": "MOBILE_SDK",
    "integrationVersion": "3.0.0.0",
    "timeZone": "America/New_York",
    "features": [
      "PHOTO_SHARING",
      "CO_APP",
      "AUTO_MESSAGES",
      "RICH_CONTENT",
      "SECURE_FORMS"
    ]
  },
  "originatorId": "d51ce914-97ad-4544-a686-8335b61dcdf3",
  "originatorMetadata": {
    "id": "d51ce914-97ad-4544-a686-8335b61dcdf3",
    "role": "CONSUMER",
    "clientProperties": {
      "type": ".ClientProperties",
      "appId": "com.liveperson.mmanguno.upgradetest23_30",
      "ipAddress": "172.26.138.214",
      "deviceFamily": "MOBILE",
      "os": "ANDROID",
      "osVersion": "27",
      "integration": "MOBILE_SDK",
      "integrationVersion": "3.0.0.0",
      "timeZone": "America/New_York",
      "features": [
        "PHOTO_SHARING",
        "CO_APP",
        "AUTO_MESSAGES",
        "RICH_CONTENT",
        "SECURE_FORMS"
      ]
    }
  },
  "event": {
    "type": "ChatStateEvent",
    "chatState": "COMPOSING"
  },
  "dialogId": "41d33e78-9701-4edd-a569-01dfb6c0f40a",
  "__isMe": false
}
```

Consumer websocket closed
```json
{
  "originatorClientProperties": {
    "type": ".ClientProperties",
    "appId": "com.liveperson.mmanguno.upgradetest23_30",
    "ipAddress": "172.26.138.214",
    "deviceFamily": "MOBILE",
    "os": "ANDROID",
    "osVersion": "27",
    "integration": "MOBILE_SDK",
    "integrationVersion": "3.0.0.0",
    "timeZone": "America/New_York",
    "features": [
      "PHOTO_SHARING",
      "CO_APP",
      "AUTO_MESSAGES",
      "RICH_CONTENT",
      "SECURE_FORMS"
    ]
  },
  "originatorId": "d51ce914-97ad-4544-a686-8335b61dcdf3",
  "originatorMetadata": {
    "id": "d51ce914-97ad-4544-a686-8335b61dcdf3",
    "role": "CONSUMER",
    "clientProperties": {
      "type": ".ClientProperties",
      "appId": "com.liveperson.mmanguno.upgradetest23_30",
      "ipAddress": "172.26.138.214",
      "deviceFamily": "MOBILE",
      "os": "ANDROID",
      "osVersion": "27",
      "integration": "MOBILE_SDK",
      "integrationVersion": "3.0.0.0",
      "timeZone": "America/New_York",
      "features": [
        "PHOTO_SHARING",
        "CO_APP",
        "AUTO_MESSAGES",
        "RICH_CONTENT",
        "SECURE_FORMS"
      ]
    }
  },
  "event": {
    "type": "ChatStateEvent",
    "chatState": "BACKGROUND"
  },
  "dialogId": "41d33e78-9701-4edd-a569-01dfb6c0f40a",
  "__isMe": false
}
```

Consumer websocket resumed
```json
{
  "dialogId": "41d33e78-9701-4edd-a569-01dfb6c0f40a",
  "changes": [
    {
      "originatorClientProperties": {
        "type": ".ClientProperties",
        "appId": "com.liveperson.mmanguno.upgradetest23_30",
        "ipAddress": "172.26.138.214",
        "deviceFamily": "MOBILE",
        "os": "ANDROID",
        "osVersion": "27",
        "integration": "MOBILE_SDK",
        "integrationVersion": "3.0.0.0",
        "timeZone": "America/New_York",
        "features": [
          "PHOTO_SHARING",
          "CO_APP",
          "AUTO_MESSAGES",
          "RICH_CONTENT",
          "SECURE_FORMS"
        ]
      },
      "originatorId": "d51ce914-97ad-4544-a686-8335b61dcdf3",
      "originatorMetadata": {
        "id": "d51ce914-97ad-4544-a686-8335b61dcdf3",
        "role": "CONSUMER",
        "clientProperties": {
          "type": ".ClientProperties",
          "appId": "com.liveperson.mmanguno.upgradetest23_30",
          "ipAddress": "172.26.138.214",
          "deviceFamily": "MOBILE",
          "os": "ANDROID",
          "osVersion": "27",
          "integration": "MOBILE_SDK",
          "integrationVersion": "3.0.0.0",
          "timeZone": "America/New_York",
          "features": [
            "PHOTO_SHARING",
            "CO_APP",
            "AUTO_MESSAGES",
            "RICH_CONTENT",
            "SECURE_FORMS"
          ]
        }
      },
      "event": {
        "type": "ChatStateEvent",
        "chatState": "ACTIVE"
      },
      "dialogId": "41d33e78-9701-4edd-a569-01dfb6c0f40a",
      "__isMe": false
    }
  ]
}
```

#### notification
This event fires on all notifications. We recommend that instead of using this listener you instead listen to the specific notification categories detailed above.

Sample code:
```javascript
agent.on('notification', body => {});
```

#### closed
This event fires when the socket is closed.  If the reason is code 4401 or 4407 this indicates an authentication issue, so when you call [reconnect()](#reconnect(skiptokengeneration)) you should make sure not to pass the `skipTokenGeneration` argument.

This event will only occur once, so if you want to attempt to reconnect repeatedly you should initiate a periodic reconnect attempt here. **LivePerson recommends that you make periodic reconnect attempts at increasing intervals up to a finite number of attempts in order to prevent flooding our service and being blocked as a potentially abusive client**. See [LivePerson's retry policy guidelines](https://developers.liveperson.com/guides-retry-policy.html) for more information.

In the sample below we attempt to reconnect 35 times, waiting 5 seconds the first time and increasing the interval by a factor of 1.25 between each attempt.

Sample code:
```javascript
const reconnectInterval = 5;        // in seconds
const reconnectAttempts = 35;
const reconnectRatio    = 1.25;     // ratio in the geometric series used to determine reconnect exponential back-off

// on connected cancel any retry interval remaining from reconnect attempt
agent.on('connected', () => {
    clearTimeout(agent._retryConnection);   
    // etc etc
});

agent.on('closed', () => {
    agent._reconnect();             // call our reconnect looper
});

agent._reconnect = (delay = reconnectInterval, attempt = 1) => {
    agent._retryConnection = setTimeout(()=>{
        agent.reconnect();
        if (++attempt <= reconnectAttempts) { agent._reconnect(reconnectInterval * reconnectRatio, attempt) }
    }, delay * 1000)
 }
```

Example payload:
```json
1006
```

#### error
This event fires when the SDK receives an error from the messaging service. If you receive a `401` error you should [reconnect()](#reconnect) according to the [retry policy guidelines](https://developers.liveperson.com/guides-retry-policy.html) mentioned above, in the [closed](#closed) section. 

Sample code:
```javascript
agent.on('error', err => {
    if (err && err.code === 401) {
        agent._reconnect();  // agent._reconnect() defined in the on('closed',() => {}) example above.
    }
});
```

Example payload:
```json
{"code":"ENOTFOUND","errno":"ENOTFOUND","syscall":"getaddrinfo","hostname":"va.agentvep.liveperson.net","host":"va.agentvep.liveperson.net","port":443}
```

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

##### ExConversationChangeNotification firstConversation - *deprecated*
In the `cqm.ExConversationChangeNotification` the field `firstConversation` is deprecated

### Further documentation

- [LivePerson messaging API][1]
- [LivePerson Chat SDK][2]

When creating a request through the request builder you should provide only the `body` to the sdk request method

### Contributing

In lieu of a formal style guide, take care to maintain the existing coding
style. Add unit tests for any new or changed functionality, lint and test your code.

- To run the tests:

   ```sh
   npm test
   ```

[1]: https://developers.liveperson.com/agent-int-api-reference.html
[2]: https://github.com/LivePersonInc/agent-sample-app
[3]: /examples
