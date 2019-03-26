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
    - Unix Shell
       ```sh
       LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASS=b0tpa55word node examples/greeting-bot/greeting-bot.js
       ```
    - Windows Shell
       ```sh
       set LP_ACCOUNT=1234567 
       set LP_USER=BotUserName 
       set LP_PASS=b0tpa55word 
       node examples/greeting-bot/greeting-bot.js
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
    - Unix Shell
        ```sh
       LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASS=b0tpa55word node examples/agent-bot/main.js
        ```
    - Windows Shell
       ```sh
       set LP_ACCOUNT=1234567 
       set LP_USER=BotUserName 
       set LP_PASS=b0tpa55word 
       node examples/agent-bot/main.js
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
    - Unix Shell
        ```sh
       APP_INST=1234-3454-34657 LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASSWORD=b0tpa55word node examples/survey-bot/main.js
        ```
    - Windows Shell
        ```sh
       set APP_INST=1234-3454-34657 
       set LP_ACCOUNT=1234567 
       set LP_USER=BotUserName 
       set LP_PASSWORD=b0tpa55word 
       node examples/survey-bot/main.js
        ```

## File Sharing Bot

The file sharing bot is an example SDK implementation which showcases file sharing capabilities. The bot performs the following actions:
1. Listens for any incoming conversation.
2. Joins the main dialog as an agent manager.
3. Generate an upload token.
4. Uploads the image to url specificed in the previous steps.
5. Publishes the image message to the conversation (publish hosted file).
6. Generates a download url for the file shared.
7. Validates that the download url is received (can only happen when file is uploaded successfuly).
8. Publishes a regular message.

This example extends the Agent class, which you can read more about below.

**Pre-requisites**:
- A LivePerson Account with Messaging enabled.
  + Account should be enable ac-feature: `Messaging.Agent_File_Sharing`
  + Account site settings should enable: `messaging.agent.file.sharing.enable`
- A user with Agent permissions. These permissions also need to be edited. To edit the agent permission: 
    * Login to your account using administrator/agent manager permissions.
    * Navigate to the users tab. 
    * Click the __Profiles__ option and then click the __Agent__ profile or create a new profile based on the __Agent__ role and there enable the following:
        + `Send files to consumers from local file browser` and/or
        + `Send files to consumers from custom widgets`

To run the [file sharing bot example][4]

- Provide the following `env` variables:
   - `LP_ACCOUNT` - Your LivePerson account ID
   - `LP_USER` - Your LivePerson agent username
   - `LP_PASS` - Your LivePerson agent password

- Run:
    - Unix Shell
        ```sh
       LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASSWORD=b0tpa55word node examples/filesharing-bot/filesharing-bot.js
    - Windows Shell
       ```sh
       set LP_ACCOUNT=1234567 
       set LP_USER=BotUserName 
       set LP_PASS=b0tpa55word 
       node examples/filesharing-bot/filesharing-bot.js
       ```

## Return To Same Agent Bot

The Return to Same Agent bot is an example SDK implementation which showcases transfer to agent capabilities. The bot performs the following actions:

1. Listens for any incoming conversations, on a pre-configured skill.
2. Acceps the conversation.
3. Waits for a notification which says that a bot has joined the conversation.
4. The bot then uses the Messaging Interactions API method, [Get Conversations by Consumer id](https://developers.liveperson.com/messaging-interactions-api-methods-get-conversations-by-consumer-id.html), in order to get all conversation for the current consumer.
5. The conversation with the best MCS record is retrieved.
6. From that conversation the bot extracts the agent id.
7. Using the Agent Metrics API method, [Agent Status](https://developers.liveperson.com/agent-metrics-api-methods-agent-status.html), the bot checks if that agent is ONLINE.
8. In case the answer is yes, it transfers the conversation to that agent.

This example extends the Agent class, which you can read more about below.

Pre-requisites:

- A LivePerson Account with Messaging enabled.
  + Account should have the ac-feature `Messaging.Transfer_To_Agent` enabled.
- A user with Agent permissions. These permissions also need to be edited. To edit the agent permission: 
    * Login to your account using administrator/agent manager permissions.
    * Navigate to the users tab. 
    * Click the __Profiles__ option and then click the __Agent__ profile or create a new profile based on the __Agent__ role and there enable the following:
        + `Transfer messaging conversations to a specific agent in 'online' or 'back soon' state`

To run the [return to same agent bot example](https://github.com/LivePersonInc/node-agent-sdk/tree/master/examples/transfer2same-agent-bot)

- Provide the following `env` variables:

   - `LP_ACCOUNT` - Your LivePerson account ID
   - `LP_USER` - Your LivePerson agent username
   - `LP_PASS` - Your LivePerson agent password

- Run:
    - Unix Shell
        ```sh
       LP_ACCOUNT=1234567 LP_USER=BotUserName LP_PASSWORD=b0tpa55word node examples/transfer2same-agent-bot/main.js
    - Windows Shell
       ```sh
       set LP_ACCOUNT=1234567 
       set LP_USER=BotUserName 
       set LP_PASS=b0tpa55word 
       node examples/transfer2same-agent-bot/main.js
       ```

## Bot Cluster

See [example documentation](https://livepersoninc.github.io/node-agent-sdk/cluster.html)

# Extending the Agent Class

The best way to use the SDK is to extend the Agent class with your own logic and then instantiate this object in your projects, as demonstrated in a very basic way in the [agent bot][2] example.

For more extensive bot examples, all of which extend the Agent class, check out the [extended messaging bot samples][4] repository.

[1]: /examples/greeting-bot/
[2]: /examples/agent-bot/
[3]: /examples/survey-bot/
[4]: https://github.com/LivePersonInc/messaging_bot_samples
