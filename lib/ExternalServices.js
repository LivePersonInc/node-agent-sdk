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
        const error = compileError('Error on AgentVEP login', err, response, body);
        callback(error, body, jar);
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
        const error = compileError('Error on AgentVEP RefreshSession', err, response, body);
        callback(error, body);
    });
}

function compileError(baseErrorMessage, err, response, body) {
    // Any status code that is bigger than 2xx
    if (response && response.statusCode > 299) {
        return new SDKError(`${baseErrorMessage}: ${response.statusMessage}`, response.statusCode);
    }

    if (body && body.error) {
        return new SDKError(`${baseErrorMessage}: ${JSON.stringify(body.error)}`, body.error.internalCode);
    }

    if (err) {
        return new SDKError(`${baseErrorMessage}: ${err.message}`, null, err);
    }

    return null;
}

module.exports = {
    login,
    refreshSession,
    compileError
};
