'use strict';

const request = require('request');

function getDomains(accountId, csdsDomain, callback) {
    if (typeof csdsDomain === 'function') {
        callback = csdsDomain;
        csdsDomain = void 0;
    }
    let url = `https://${csdsDomain || 'adminlogin.liveperson.net'}/api/account/${accountId}/service/baseURI.json?version=1.0`;

    request({
        url: url,
        json: true
    }, (err, response, body) => {
        let domains = {};
        if (body && body.baseURIs) {
            if (body.baseURIs.length) {
                for (let i = 0; i < body.baseURIs.length; i++) {
                    let uriEntry = body.baseURIs[i];
                    domains[uriEntry.service] = uriEntry.baseURI;
                }
            }
        }
        callback(err, domains);
    });
}

function login(options, callback) {
    let url = `https://${options.domain}/api/account/${options.accountId}/login?v=1.3`;
    let body = {};
    if (options.username && options.password) {
        body.username = options.username;
        body.password = options.password;
    } else {
        body.jwt = 'dummy';//TODO: remove - this is a hack against the vep
        body.assertion = options.assertion;
    }
    let jar = request.jar();
    request.post({
        url: url,
        jar: jar,
        body: body,
        json: true
    }, (err, response, body) => {
        callback(err, body, jar);
    });
}

function getAgentId(options, callback) {
    let url = `https://${options.domain}/api/account/${options.accountId}/configuration/le-users/users/${options.user}?v=4.0&select=$all'`;

    request.get({
        url: url,
        headers: {
            Authorization: `Bearer ${options.token}`
        },
        json: true
    }, (err, response, body) => {
        callback(err, body);
    });
}

function refreshSession(options, callback) {
    let url = `https://${options.domain}/api/account/${options.accountId}/refresh?v=1.3`;

    request.post({
        url: url,
        body: {
            csrf: options.csrf,
        },
        jar: options.jar,
        json: true
    }, (err, response, body) => {
        callback(err, body);
    });
}

module.exports = {
    getDomains,
    getAgentId,
    login,
    refreshSession
};
