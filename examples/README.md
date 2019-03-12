# Running The Sample Apps

- [Greeting Bot](#greeting-bot)
- [Agent Bot](#agent-bot)
- [Survey Bot](#survey-bot)
- [File Sharing Bot](#file-sharing-bot)
- [Return To Same Agent Bot](#return-to-same-agent-bot)
- [Bot Cluster](#bot-cluster)
- [Extending the Agent Class](#extending-the-agent-class)

## Greeting Bot
The greeting bot is a very simple implementation of the SDK in which the bot joins every conversation as a manager and sends the line "welcome from bot".

Pre-requisites:
- A LivePerson Account with Messaging
- A user with Agent Manager permissions

To run the [greeting bot example][1]:

- Provide the following `env` variables:
   - `LP_ACCOUNT` - Your LivePerson account ID
   - `LP_USER` - Your LivePerson agent username
   - `LP_PASS` - Your LivePerson agent password

- Run:

   ```sh
   LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASS=b0tpa55word node examples/greeting-bot/greeting-bot.js
   ```

## Agent Bot
The agent bot is an example SDK implementation in which the bot accepts incoming conversations as the assigned agent. It listens for messages from the consumer and upon receipt marks them as read and echos them back to the consumer.  This example extends the Agent class, which you can read more about below.

See [example explanation](https://livepersoninc.github.io/node-agent-sdk/agent-bot.html)

Pre-requisites:
- A LivePerson Account with Messaging
- A user with Agent permissions

To run the [agent bot example][2]

- Provide the following `env` variables:
   - `LP_ACCOUNT` - Your LivePerson account ID
   - `LP_USER` - Your LivePerson agent username
   - `LP_PASS` - Your LivePerson agent password

- Run:

    ```sh
   LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASS=b0tpa55word node examples/agent-bot/main.js
    ```

## Survey Bot
The survey bot is an example SDK implementation in which the bot waits on a survey dialog, validates the application id with its own and joins the dialog.
It automatically starts a survey of one question, listens on responses and upon correct response, closes the dialog.
This example extends the Agent class, which you can read more about below.

Pre-requisites:
- A LivePerson Account with Messaging
- A user with Agent permissions
- Application installation id with `ms_survey` capability (ask your LivePerson account representative to create one for you and provide you with the id)
- Assign your application installation id to a specific skill(s) that if the conversation ends on your bot will start operating - not your bot skill (ask your LivePerson account representative to assign it for you)

To run the [survey bot example][3]

- Provide the following `env` variables:
   - `LP_ACCOUNT` - Your LivePerson account ID
   - `LP_USER` - Your LivePerson agent username
   - `LP_PASS` - Your LivePerson agent password
   - `APP_INST` - Your bot app installation id

- Run:

    ```sh
   APP_INST=1234-3454-34657 LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASSWORD=b0tpa55word node examples/survey-bot/main.js
    ```

## File Sharing Bot
The file sharing bot is an example SDK implementation in which the bot 
1. Waits for any conversation coming
2. Joins the main dialog as a manager
3. Generate an upload token
4. Upload the image to specified url from the previous step
5. Publish the image message to the conversation (publish hosted file)
6. Generate a download url for the file shared
7. Validates that download url is received (only can happen when file is uploaded successfuly)
8. Publish a regular message
This example extends the Agent class, which you can read more about below.

Pre-requisites:
- A LivePerson Account with Messaging
  + Account should be enable ac-feature: `Messaging.Agent_File_Sharing`
  + Account site settings should enable: `messaging.agent.file.sharing.enable`
- A user with Agent permission, need to edit the agent permission: login to your account using administrator/agent manager permissions, and go to users tab. In the users tab click the __Profiles__ and click the __Agent__ or create new profile based on the __Agent__ role and there enable the following
  + `Send files to consumers from local file browser` and/or
  + `Send files to consumers from custom widgets`

To run the [file sharing bot example][4]

- Provide the following `env` variables:
   - `LP_ACCOUNT` - Your LivePerson account ID
   - `LP_USER` - Your LivePerson agent username
   - `LP_PASS` - Your LivePerson agent password

- Run:

    ```sh
   LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASSWORD=b0tpa55word node examples/filesharing-bot/filesharing-bot.js

## Return To Same Agent Bot
The file return to same agent bot is an example SDK implementation in which the bot 
1. Waits for any conversation coming, on a pre-configured skill
2. Accept the ring
3. Wait for notification says that bot has joined the con conversation
4. Bot then using the Messaging Interaction API, [Get Conversations by Consumer id](https://developers.liveperson.com/messaging-interactions-api-methods-get-conversations-by-consumer-id.html), in order to get all conversation from the current consumer
5. Get the conversation with the best MCS record
6. From that conversation Bot extract the agent id
7. Using the Agent Metrics API, [Agent Status](https://developers.liveperson.com/agent-metrics-api-methods-agent-status.html), check if that agent is ONLINE
8. In case answer is yes, transfer the conversation to that agent

This example extends the Agent class, which you can read more about below.

Pre-requisites:
- A LivePerson Account with Messaging
  + Account should be enable ac-feature: `Messaging.Transfer_To_Agent`
- A user with Agent permission, need to edit the agent permission: login to your account using administrator/agent manager permissions, and go to users tab. In the users tab click the __Profiles__ and click the __Agent__ or create new profile based on the __Agent__ role and there enable the following
  + `Transfer messaging conversations to a specific agent in 'online' or 'back soon' state`

To run the [return to same agent bot example][4]

- Provide the following `env` variables:
   - `LP_ACCOUNT` - Your LivePerson account ID
   - `LP_USER` - Your LivePerson agent username
   - `LP_PASS` - Your LivePerson agent password

- Run:

    ```sh
   LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASSWORD=b0tpa55word node examples/transfer2same-agent-bot/main.js

## Bot Cluster

See [example documentation](https://livepersoninc.github.io/node-agent-sdk/cluster.html)

# Extending the Agent Class

The best way to use the SDK is to extend the Agent class with your own logic and then instantiate this object in your projects, as demonstrated in a very basic way in the [agent bot][2] example.

For more extensive bot examples, all of which extend the Agent class, check out the [extended messaging bot samples][4] repository.

[1]: /examples/greeting-bot/
[2]: /examples/agent-bot/
[3]: /examples/survey-bot/
[4]: https://github.com/LivePersonInc/messaging_bot_samples
