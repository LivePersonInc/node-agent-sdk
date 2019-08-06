'use strict';

class ParseError extends Error {
    constructor(error, payload) {
        super(error);
        this.stack = error.stack;
        this.payload = payload;
    }
}

module.exports = ParseError;
