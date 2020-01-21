

const GreetingBot = require('./greeting-bot');

const conf = {
    accountId: process.env.LP_ACCOUNT,
    username: process.env.LP_USER,
    password: process.env.LP_PASS
};

if (process.env.LP_CSDS) {
    conf.csdsDomain = process.env.LP_CSDS;
}

const bot = new GreetingBot(conf);
