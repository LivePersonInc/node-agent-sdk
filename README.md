node-agent-sdk
========
[![npm version](https://img.shields.io/npm/v/node-agent-sdk.svg)](https://img.shields.io/npm/v/node-agent-sdk)
[![npm downloads](https://img.shields.io/npm/dm/node-agent-sdk.svg)](https://img.shields.io/npm/dm/node-agent-sdk.svg)
[![license](https://img.shields.io/npm/l/node-agent-sdk.svg)](LICENSE)

> LivePerson Agent Messaging SDK for NodeJS
The SDK provides a simple node js wrapper for the [LivePerson messaging API](http://ec2-54-175-164-201.compute-1.amazonaws.com:4180/v3/consumer-interation-index.html).

Getting Started
---------------
- Install: `npm i node-agent-sdk --save`
- Run the [example](/examples/bot.js): Provide the following env variables and run `npm run`:
  - `ACCOUNT` - Your LivePerson account Id
  - `USERNAME` - Your LivePerson agent username
  - `PASSWORD` - Your LivePerson agent password
- Run tests: `npm test`

### Example
```javascript
const Agent = require('node-agent-sdk').Agent;

const agent = new Agent({
    accountId: process.env.ACCOUNT,
    username: process.env.USERNAME,
    password: process.env.PASSWORD
});

agent.on('connected', () => {
    console.log(`connected... ${agent.agentId}`);

    agent.subscribeExConversations({
        'convState': ['OPEN']
    }, (err, resp) => {
        console.log('subscribed successfully', err, resp);
    });
});
```

API Overview
-------------
###Agent class
```javascript
new Agent({
    accountId: String,
    username: String,
    password: String,
    token: String, //a bearer token instead of username and password
    csdsDomain: String, //override the CSDS domain if needed
    requestTimeout: Number, //default to 10000 milliseconds
    errorCheckInterval: Number, //defaults to 1000 milliseconds
    apiVersion: Number //Messaging API version - defaults to 2
});

```
###Events
```javascript
agent.on('connected', msg => {
    //once socket connected to the server
});

agent.on('notification', message => {
    //listen on all notifications
});

agent.on('.MessagingEvent', body => { //specific notification type
    //listen on all notifications
});

agent.on('.ams.ms.QueryMessages', (body, requestId) => { //specific response type
    //listen on all notifications
});

agent.on('closed', reason => {
    //socket closed
});

agent.on('error', err => {
    //Some error happened
});

```

### API
All requests types are dynamically assigned to the object on creation.
The supported API calls are a mirror of the API, please read the documentation carefully for full examples:
The list of api calls are:
`getClock, getBrands, getBrandProfile, setBrandProfile, agentRequestConversation, consumerRequestConversation, subscribeExConversations, unsubscribeExConversations, updateExConversationSubscription, updateConversationField, publishEvent, queryMessages, updateRingState, subscribeRoutingTasks, updateRoutingTaskSubscription, setUserProfile, getUserProfile, setAgentState, subscribeAgentsState`

#### registerRequests(arr)
You can dynamically add functionality to the sdk by registring more requests.
For example:
```javascript
registerRequests(['.ams.AnotherTypeOfRequest']);
//Will register the following api
agent.anotherTypeOfRequest({/*some data*/}, (err, response) => {
    //do something
});
```
#### request(type, body[, headers], callback)
You can additionally call any request api functionality as follows:
```javascript
agent.request('.ams.aam.SubscribeExConversations', {
        'convState': ['OPEN']
    }, (err, resp) => {
        console.log('subscribed successfully', err, resp);
    });
```

### Further documentation
- [LivePerson messaging API](http://ec2-54-175-164-201.compute-1.amazonaws.com:4180/v3/consumer-interation-index.html)
- [LivePerson chat SDK](https://github.com/LivePersonInc/chat-agent)
