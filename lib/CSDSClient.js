const NodeCache = require('node-cache');
const request = require('request');
const urlPattern = ({csdsDomain, accountId}) => `https://${csdsDomain}/api/account/${accountId}/service/baseURI.json?version=1.0`;
const defaults = {
    stdTTL: 60,
    checkperiod: 30,
    csdsDomain: 'adminlogin.liveperson.net'
};

class CSDSClient {

    constructor(options) {
        options = options || {};
        this.options = {};
        Object.assign(this.options, defaults, options);

        this.cache = new NodeCache(this.options);
    }

    getAll(cb) {
        const url = urlPattern(this.options);
        const cachedDomains = this.cache.get(this.options.accountId);
        if (cachedDomains) {
            cb(null, cachedDomains);
        } else {
            request({
                url: url,
                json: true
            },(err, res, body) => this.requestHandler(err, res, body, cb));
        }
    }

    requestHandler(err, response, body, cb) {
        let domains;

        if (err) {
            return cb(err);
        }

        if (body && body.baseURIs) {
            domains = CSDSClient.convert(body.baseURIs);
        }

        if (domains && Object.keys(domains).length !== 0) {
            this.cache.set(this.options.accountId, domains);
        }
        cb(null, domains);
    }

    static convert(urisArray) {
        const domains = {};
        if (urisArray && urisArray.length) {
            for (let i = 0; i < urisArray.length; i++) {
                let uriEntry = urisArray[i];
                domains[uriEntry.service] = uriEntry.baseURI;
            }
        }
        return domains;
    }
}

module.exports = CSDSClient;
