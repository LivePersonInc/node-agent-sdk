## Running The Sample Apps

### Extended Bot class
The best way to use the SDK is to extend the Agent class with your own logic and then instantiate this object in your 
projects. The three examples below all rely on a sample [Bot class][1] that extends Agent.

#### Agent Example
This is an example of a bot acting as an Agent. It starts in the 'ONLINE' state and subscribes only to updates for its 
own conversations. It receives new conversations by subscribing to `routingTaskNotification` events which indicate that 
new conversations have entered the relevant skill queue and are 'ringing' to the bot. The bot consumes these routing events 
and accepts all incoming conversations, thereby joining with the role 'ASSIGNED_AGENT'.

This bot then takes various actions in response to messages from the visitor. For example:

- If the visitor says "time" or "date" the bot will respond with the relevant information (local time of bot system)
- If the visitor says "content" the bot will send a structured content object.
  - Further information about creating valid structured content objects can be found [here][2]
- If the visitor says "transfer" the bot will transfer the conversation to the configured transferSkill.
  - In order for the bot to successfully transfer conversations to a new skill you must set the value of `const transferSkill` 
  in `agent.js` to a string matching the Skill ID of the target skill. You can obtain your skill ID using the [Skills API][3].
- If the visitor says "close" the bot will close the conversation
- Anything else the visitor says the bot will simply repeat back to the visitor prefixed with "you said ".

#### Reader Example
This is an example of a bot acting as a Reader. It starts in the 'AWAY' state so that no conversations will 'ring' to it,
but it subscribes to updates for all conversations on the account. When any new conversation begins the bot adds itself 
as a participant with the role 'READER'. This role is appropriate for bots which need to see chat lines and and metadata
about the consumer and the agent assigned to the conversation (whether human or bot) but do not need to participate in 
the conversation in any way.

#### Manager Example
This is an example of a bot acting as a Manager. It starts in the 'AWAY' state so that no conversations will 'ring' to it,
but it subscribes to updates for all conversations on the account. When any new conversation begins the bot adds itself 
as a participant with the role 'MANAGER'. It then sends a message into the conversation stating that it has joined, which
both the 'ASSIGNED_AGENT' and the consumer can see

### Greeting Bot
The greeting bot is a very simple implementation of the SDK in which the bot joins every conversation as a manager and
sends the line "welcome from bot".

Pre-requisites:
- A LivePerson Account with Messaging
- A user with Agent Manager permissions

To run the [greeting bot example][9]:

- Provide the following `env` variables:
   - `LP_ACCOUNT` - Your LivePerson account ID
   - `LP_USER` - Your LivePerson agent username
   - `LP_PASS` - Your LivePerson agent password

- If you are consuming the Agent Messaging SDK as a dependency, switch to the
package root:

   ```sh
   cd ./node_modules/node-agent-sdk
   ```

  If you have cloned this repository the package root is the same as the repository root and there is no need to change directories.

- Run with npm:

   ```sh
   npm run-script example_greeting-bot
   ```
   
[1]: /examples/extended-agent-class/bot/bot.js
[2]: https://developers.liveperson.com/structured-content-templates.html
[3]: https://developers.liveperson.com/overview.html
[9]: /examples/greeting-bot/greeting-bot.js
