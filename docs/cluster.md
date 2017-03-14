# Bot Cluster Example

This examples demonstrates running bot on horizontally scalable cluster.
It might be used for a few use cases:

1. **Bot Resiliency** - If one node crashes, on of the others will reconnect the bot.
2. **Multiple Bots** - The bots will be spread on the nodes of the cluster. If one node fails the others will share its bots. If a new node is added to the cluster it will take some of the bots of every other node.

## Demo
<iframe width="560" height="315" src="https://www.youtube.com/embed/4FgZa87sDho" frameborder="0" allowfullscreen></iframe>

## Code Review
<iframe width="560" height="315" src="https://www.youtube.com/embed/QZiNzkWgPWk" frameborder="0" allowfullscreen></iframe>

## Prerequisites

1. You should have an account with a few agent users.
2. Install docker and docker-compose on your machine to run this example.

## Usage

First you will have to create you configuration file. Put you json config content in the ``examples/cluster/local/agents.json`` file.
The file should contain an array of objects with the account/user/password information. For example:

```json
[{
    "accountId": "61326154",
    "username": "myagent1",
    "password": "secret"
},
{
    "accountId": "61326154",
    "username": "myagent2",
    "password": "secret"
}] 
```

Now change directory to ``examples/cluster`` and run:

```sh
npm i
docker-compose up -d
```
This will initialize the zookeeper dependency and launch one node to handle all of your bots.

You can view the logs of the cluster:

```sh
 docker-compose logs -f app
```

You can add nodes to the cluster by changing its scale, for example:

```sh
 docker-compose scale app=3
```

You will be able to see in the logs the new task distribution.

You can shutdown the cluster by:

```sh
docker-compose kill && docker-compose rm -f
```
