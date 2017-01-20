'use strict';

function toFuncName(reqType) {
    const str = reqType.substr(1 + reqType.lastIndexOf('.'));
    return str.charAt(0).toLowerCase() + str.slice(1);
}

module.exports = {
    toFuncName
};
