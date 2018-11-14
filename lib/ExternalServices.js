'use strict';

const request = require('request');
const packageJson = require('../package.json');
const SDKError = require('./error/SDKError');
const USER_AGENT_HEADER = `NodeAgentSDK/${packageJson.version}`;

function login(options, callback) {
    let url = `https://${options.domain}/api/account/${options.accountId}/login?v=1.3`;
    let body = {};
    if (options.username && options.password) {
        body.username = options.username;
        body.password = options.password;
    } else if (options.assertion) {
        body.jwt = 'dummy';//TODO: remove - this is a hack against the agent vep
        body.assertion = options.assertion;
    } else {
        body.username = options.username;
        body.appKey = options.appKey;
        body.secret = options.secret;
        body.accessToken = options.accessToken;
        body.accessTokenSecret = options.accessTokenSecret;
    }
    let jar = request.jar();
    request.post({
        url: url,
        jar: jar,
        body: body,
        headers: {
            'User-Agent': USER_AGENT_HEADER
        },
        json: true
    }, (err, response, body) => {
        let sdkError;
        if (body && body.error) {
            sdkError = new SDKError(body.error, body.internalCode);
        }
        callback(err || sdkError, body, jar);
    });
}

function refreshSession(options, callback) {
    let url = `https://${options.domain}/api/account/${options.accountId}/refresh?v=1.3`;

    request.post({
        url: url,
        body: {
            csrf: options.csrf,
        },
        headers: {
            'User-Agent': USER_AGENT_HEADER
        },
        jar: options.jar,
        json: true
    }, (err, response, body) => {
        let authError;
        if (response && response.statusCode && response.statusCode === 401) {
            authError = new SDKError('session unauthorized', 401);
        }
        callback(err || authError, body);
    });
}

module.exports = {
    login,
    refreshSession
};
