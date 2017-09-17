'use strict';

class SDKError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}

module.exports = SDKError;
