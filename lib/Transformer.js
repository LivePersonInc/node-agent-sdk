'use strict';

function translator(body) {
    return body;
}

module.exports = {
    'request.name': {
        onRequest: translator,
        onResponse: translator
    },
    'notification.type' : translator
};
