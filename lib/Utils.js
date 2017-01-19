'use strict';

function runCallBack(func, data, context) {
    try {
        if(typeof func === 'function') {
            func.call(context || null, data);
        }
    } catch (exc) {
        // continue regardless of error
    }
}

function toFuncName(reqType) {
    const str = reqType.substr(1 + reqType.lastIndexOf('.'));
    return str.charAt(0).toLowerCase() + str.slice(1);
}

module.exports = {
    runCallBack, toFuncName
};
