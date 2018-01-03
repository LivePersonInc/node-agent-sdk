## Running The Sample Apps




### Greeting Bot
To run the [greeting bot example][2]:

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
   
[1]: /example-bot/
[2]: /greeting-bot/greeting-bot.js
[3]: /agent-bot/main.js
[4]: /cluster/
