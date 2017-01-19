'use strict';
const request = require('request');

function getDomains(accountId, csdsDomain, callback) {
    if (typeof csdsDomain === 'function') {
        callback = csdsDomain;
        csdsDomain = void 0;
    }
    let url = `http://${csdsDomain || 'adminlogin.liveperson.net'}/api/account/${accountId}/service/baseURI.json?version=1.0`;

    request({
        url: url,
        timeout: this.timeout,
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
    let url = `http://${options.domain}/api/account/${options.accountId}/login`;

    request({
        url: url,
        timeout: this.timeout,
        body: {
            username: options.username,
            password: options.password
        },
        json: true
    }, (err, response, body) => {
        callback(err, body && body.bearer);
    });
}

module.exports = {
    getDomains, login
};
