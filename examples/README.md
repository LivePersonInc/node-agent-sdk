# Running The Sample Apps

- [Greeting Bot](#greeting-bot)
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

- Run with npm:

   ```sh
   npm run-script example_greeting-bot
   ```
   
   
# Extending the Agent Class

The best way to use the SDK is to extend the Agent class with your own logic and then instantiate this object in your projects.

This is demonstrated in a very basic way in the [agent bot][2] example. 

For more extensive bot examples, all of which extend the Agent class, check out the [extended messaging bot samples][3] repository.


[1]: /examples/greeting-bot/greeting-bot.js
[2]: /examples/agent-bot/
[3]: https://github.com/LivePersonInc/messaging_bot_samples
