
# node-agent-sdk

[![npm version](https://img.shields.io/npm/v/node-agent-sdk.svg)](https://img.shields.io/npm/v/node-agent-sdk)
[![npm downloads](https://img.shields.io/npm/dm/node-agent-sdk.svg)](https://img.shields.io/npm/dm/node-agent-sdk.svg)
[![license](https://img.shields.io/npm/l/node-agent-sdk.svg)](LICENSE)

> LivePerson Agent Messaging SDK for NodeJS

The SDK provides a simple node js wrapper for the [LivePerson messaging API][1].


## Getting Started

- Install:

```sh
npm i node-agent-sdk --save
```

- Run the [bot example](/examples/bot.js) (see how in [Running The Sample App](#running-the-sample-app)).


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


## API Overview


### Agent class

```javascript
new Agent({
    accountId: String,
    username: String,
    password: String,
    token: String, // a bearer token instead of username and password
    csdsDomain: String, // override the CSDS domain if needed
    requestTimeout: Number, // default to 10000 milliseconds
    errorCheckInterval: Number, // defaults to 1000 milliseconds
    apiVersion: Number // Messaging API version - defaults to 2
});
```


### Events

```javascript
agent.on('connected', msg => {
    // socket is now connected to the server
});

agent.on('notification', message => {
    // listen on all notifications
});

agent.on('.MessagingEvent', body => { // specific notification type
    // listen on notifications of the MessagingEvent type
});

agent.on('.ams.ms.QueryMessages', (body, requestId) => { // specific response type
    // listen on notifications of the specified type, do something with the requestId
});

agent.on('closed', reason => {
    // socket is now closed
});

agent.on('error', err => {
    // some error happened
});
```


### Messaging API

All requests types are dynamically assigned to the object on creation.
The supported API calls are a mirror of the LE Messaging API, please read 
the documentation carefully for full examples.

The available API calls are:

```
getClock
getBrands
getBrandProfile
setBrandProfile
agentRequestConversation
consumerRequestConversation
subscribeExConversations
unsubscribeExConversations
updateExConversationSubscription
updateConversationField
publishEvent
queryMessages
updateRingState
subscribeRoutingTasks
updateRoutingTaskSubscription
setUserProfile
getUserProfile
setAgentState
subscribeAgentsState`
```


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


### Further documentation

- [LivePerson messaging API][1]
- [LivePerson chat SDK][2]


## Running The Sample App

To run the [bot example](/examples/bot.js):

- Provide the following `env` variables:
   - `ACCOUNT` - Your LivePerson account ID
   - `USERNAME` - Your LivePerson agent username
   - `PASSWORD` - Your LivePerson agent password

- If you're consuming the node-agent-sdk as a dependency, switch to the 
package root:

```sh
cd ./node_modules/node-agent-sdk
```

If you're a developer, the package root is the same as the repository root, 
so there's no need to change directories.

- Run with npm:

```sh
npm start
```


## Contributing

In lieu of a formal styleguide, take care to maintain the existing coding 
style. Add unit tests for any new or changed functionality, lint and test your code.

To run the tests:

```sh
npm test
```

To run the [bot example](/examples/bot.js), see [Running The Sample App](#running-the-sample-app).





[1]: http://ec2-54-175-164-201.compute-1.amazonaws.com:4180/v3/consumer-interation-index.html
[2]: https://github.com/LivePersonInc/chat-agent
