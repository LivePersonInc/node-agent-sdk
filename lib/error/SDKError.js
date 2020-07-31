'use strict';

class SDKError extends Error {
    constructor(message, code, err = null) {
        super(message);
        this.code = code;
        this.error = err;
    }
}

module.exports = SDKError;
