# task-sharding-demo

This project demonstrates sharding responsiblity between nodes in a cluster.

Open the following video in a new tab to see it in action.

[![Demo CountPages alpha](https://www.zpesystems.com/wp-content/uploads/2015/03/watch-demo-graphic-300x248.png)](https://drive.google.com/a/liveperson.com/file/d/0ByjMYuOIDToKTS1Lc3JGYnFhZ0E/view?usp=sharing)


## Running the example

### Prerequisites

* docker-compose
* npm

### Example Description 

We have simple service with known set of `ConversationIDs`, we want that each node will handle separate subset of those `ConversationIDs`.

In order to do that we have to require the ``task-sharding`` and register callback that will notify us every time the division of work has been changed. 

The callback will be given two parameters, the serviceInstance, and consistent-hashing ring. The ring returns the owner for any conversationID. Here is the code:

```js
const zkConnStr = `${process.env.ZK_PORT_2181_TCP_ADDR}:${process.env.ZK_PORT_2181_TCP_PORT}`;

var TaskSharding = require('./task-sharding.js');
var taskSharding = new TaskSharding(zkConnStr);

var allTasks = ['aa','bb','cc','dd','ee','ff','gg','hh','ii','jj'];


taskSharding.onClusterChange((myServiceInstance,updatedHashRing)=> {
    const isOwnedByMe = task => updatedHashRing.get(task)===myServiceInstance.data.id;
    const myTasks = allTasks.filter(isOwnedByMe);
    console.log(myTasks);
});
```

### Running

In order to run it, download and unzip the repository. Then run:

```sh
cd task-sharding-demo
npm install
docker-compose up -d && docker-compose logs -f app
```
In the logs you can see the nodes' statements regarding their task responsablity.

You can addd nodes to the cluster by opening another shell window and:

```sh
cd task-sharding-demo
docker-compose scale app=5
```

In the logs you will see new nodes coming in and new work division. Then you can kill some of the nodes by cahnging the scale again:
```sh
docker-compose scale app=2
```





