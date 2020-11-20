'use strict';

class SDKError extends Error {
    constructor(message, code, service, err = null) {
        super(message);
        this.code = code;
        this.service = service;
        this.error = err;
    }
}

module.exports = SDKError;
