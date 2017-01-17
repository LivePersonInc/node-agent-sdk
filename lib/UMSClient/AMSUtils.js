window.lpTag = window.lpTag || {};
lpTag.AMSUtils =  lpTag.AMSUtils || function() {

    var name = "AMSUtils",
        validationTypes = {
            BOOL: "boolean",
            STRING: "string",
            ARRAY: "Array",
            NUMBER: "number",
            CUSTOM: "custom",
            ENUM: "enum"
        },
        logType = {
            DEBUG: "DEBUG",
            INFO: "INFO",
            ERROR: "ERROR"
        };

    /**
     * Executes a callback safely
     * @param func
     * @param data
     * @param context
     * @private
     */
    function runCallBack(func, data, context) {
        try {
            if(typeof func === "function") {
                func.call(context || null, data);
            }
        } catch (exc) {
            error("Error executing callback", "runCallBack");
        }
    }

    /**
     * Method for logging
     * @param msg
     * @param type
     * @param callingMethod
     */
    function log(msg, type, callingMethod) {
        if (window.lpTag && window.lpTag.log) {
            window.lpTag.log(callingMethod + ": " + msg, type, name);
        }
    }

    /**
     * Shorthand for error logs
     * @param msg
     * @param methodName
     * @private
     */
    function error(msg, methodName) {
        log(msg, logType.ERROR, methodName);
    }

    /**
     * Shorthand for debug logs
     * @param msg
     * @param methodName
     * @private
     */
    function debug(msg, methodName) {
        log(msg, logType.DEBUG, methodName);
    }

    /**
     * Shorthand for info logs
     * @param msg
     * @param methodName
     * @private
     */
    function info(msg, methodName) {
        log(msg, logType.INFO, methodName);
    }

    /**
     * Merges two objects favoting the new one
     * @param oldObj
     * @param newObj
     * @returns {*}
     * @private
     */
    function overRideMerge(oldObj, newObj) {
        for (var key in newObj) {
            if (newObj.hasOwnProperty(key)) {
                oldObj[key] = newObj[key];
            }
        }
        return oldObj;
    }

    /**
     * Gets some data according to configuration
     * @param obj
     * @param modelStructure
     * @returns {{}}
     * @private
     */
    function remodel(obj, modelStructure) {
        var resultObject = {};
        for (var key in modelStructure) {
            resultObject[key] = getProperty(obj, modelStructure[key]);
        }
        return resultObject;
    }

    /**
     * Gets a specific property from an object
     * @param obj
     * @param path
     * @returns {*}
     * @private
     */
    function getProperty(obj, path) {
        var pathNames = path.split("."),
            currentLocation = obj;
        for (var i = 0; i < pathNames.length; i++) {
            if (typeof currentLocation !== 'undefined' && currentLocation !== null &&
                typeof currentLocation[pathNames[i]] !== 'undefined' && currentLocation[pathNames[i]] !== null) {
                currentLocation = currentLocation[pathNames[i]];
            } else {
                currentLocation = null;
                break;
            }
        }
        return currentLocation;
    }

    function getValues(obj) {
        var values = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                values.push(obj[key]);
            }
        }
        return values;
    }

    /**
     * Validates input on an object
     * @param conditions
     * @param message
     * @returns {boolean}
     * @private
     */
    function validateConditions(conditions, message) {
        var valid = true;
        for (var key in conditions) {
            if (conditions.hasOwnProperty(key)) {
                valid = validateCondition(message[key], conditions[key].type, conditions[key].expected, conditions[key].optional);
                if (!valid) {
                    break;
                }
            }
        }
        if (!valid) {
            runCallBack(message && message.error, {
                error: "failed validation on key: " + key,
                statusCode: 400
            }, message.context);
        }
        return valid;
    }

    /**
     * Validates a specific condition
     * @param value - the value we are validating
     * @param validationType - types include: string, boolean, enum, custom (validates against the expected value, array
     * @param expected
     * @returns {*}
     * @private
     */
    function validateCondition(value, validationType, expected, optional) {
        if(optional === true && typeof value === "undefined") {
            return true;
        } else if (validationType === validationTypes.CUSTOM) {
            return value === expected;
        } else if (validationType === validationTypes.ARRAY) {
            return (value && value.constructor === Array);
        } else if (validationType === validationTypes.ENUM) {
            return existsInEnum(value, expected);
        } else {
            return typeof value === validationType;
        }
    }

    /**
     * Checks if a value exists in an enum
     * @param value
     * @param enumObj
     * @returns {boolean}
     * @private
     */
    function existsInEnum(value, enumObj) {
        for (var key in enumObj) {
            if (enumObj.hasOwnProperty(key) && enumObj[key] === value) {
                return true;
            }
        }
        return false;
    }

    function templateString(template, data){
        var regex;
        for(var key in data){
            if(data.hasOwnProperty(key) && validateCondition(data[key], validationTypes.STRING) || validateCondition(data[key], validationTypes.NUMBER)){
                regex = new RegExp("{{" + key + "}}", 'i');
                template = template.replace(regex, data[key]);
            }
        }
        return template;
    }

    function templateStrings(templates, data){
        if(validateCondition(templates, validationTypes.ARRAY)){
            for(var i =0; i < templates.length; i++){
                if(validateCondition(templates[i], validationTypes.STRING)) {
                    templates[i] = templateString(templates[i], data);
                }
            }
        }else if(validateCondition(templates, validationTypes.STRING)){
            templates = templateString(templates, data);
        }
        return templates;
    }

    function getUID() {
        var UID = 'tttttttt-tttt-4ttt-fttt-t7ttttttttttt'.replace(/[tf]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 't' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        return  UID + '-' + Math.floor(Math.random() * 100000);
    }

    /**
     * Checks if two objects are identical (order of values is not important)
     * match exactly
     * @param obj
     * @param objToCompare
     * @returns {boolean}
     */
    function isSameObject(obj, objToCompare) {
        var sameLength = !obj || !objToCompare || Object.keys(obj).length ===  Object.keys(objToCompare).length;
        return _isSameObject(obj, objToCompare) && sameLength;
    }

    function _isSameObject(obj, objToCompare) {
        var similarObject = typeof obj === typeof objToCompare;
        if (similarObject) {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (objToCompare.hasOwnProperty(key)) {
                        if (typeof obj[key] === 'object' && obj[key] !== null) {
                            if (obj[key].constructor !== Array) {
                                similarObject = isSameObject(obj[key], objToCompare[key]);
                            } else {
                                similarObject = stringify(obj[key]) === stringify(objToCompare[key]);
                            }
                        } else if (typeof obj[key] === 'function') {
                            similarObject = ('' + obj[key]) === ('' + objToCompare[key]);
                        } else {
                            similarObject = obj[key] === objToCompare[key];
                        }
                    } else {
                        similarObject = false;
                    }
                }

                if (!similarObject) {
                    break;
                }
            }
        }
        return similarObject;
    }

    /**
     * This function was added because of incompatibility between the JSON.stringify and Prototype.js library
     * When a costumer uses Prototype.js library, It overrides the Array.prototype.toJSON function the the native JSON
     * uses. This causes arrays to be double quoted and Shark to fail on those SDEs.
     * The function accepts a value and uses the native JSON.stringify
     * Can throw an exception (same as JSON.stringify).
     * @param value
     * @returns {string}
     */
    function stringify(value) {
        var stringified, toJSONPrototype;
        if (typeof Array.prototype.toJSON === 'function') {
            toJSONPrototype = Array.prototype.toJSON;
            delete Array.prototype.toJSON;
            try {
                stringified = JSON.stringify(value);
            } catch (e) {
                Array.prototype.toJSON = toJSONPrototype;
                throw e;
            }
            Array.prototype.toJSON = toJSONPrototype;
        } else {
            stringified = JSON.stringify(value);
        }
        return stringified;
    }

    /**
     * Gets an object and returns its copy
     * @param obj
     * @returns {object}
     */
    function clone(obj) {
        try {
            return JSON.parse(stringify(obj));
        }
        catch (e) {
            lpTag.log('unable to clone object:' + JSON.stringify(e), 'ERROR', name);
            return;
        }
    }

    /**
     * Gets two objects (obj and extendObj) and boolean and returns:
     *  - obj, if its type differs from object
     *  - copy of obj, if extendObj is empty
     *  - object extendObj, extended with the obj object (recursively if deep is true)
     *    (undefined values from obj will not be copied to extendObj)
     * @param obj
     * @param extendObj
     * @param deep
     * @returns {object}
     */
    function cloneExtend(obj, extendObj, deep) {
        var newObj;

        if (!obj || "object" !== typeof obj) {
            return obj;
        }

        if (!extendObj) {
            return clone(obj);
        }

        newObj = extendObj || obj.constructor() || {};
        for (var prop in obj) {
            // Prevent never-ending loop
            if (newObj[prop] === obj[prop]) {
                continue;
            }

            if (obj.hasOwnProperty(prop)) {
                newObj[prop] = deep ? cloneExtend(obj[prop], void 0, deep) : obj[prop];
            }
        }

        return newObj;
    }

    /**
     * Checks if object is not empty (whitespaces are considered as non-empty values,
     * null, undefined, etc. also but only as values inside objects). Only objects'
     * own properties are considered
     * @param obj
     * @returns {boolean}
     */
    function isEmpty(obj) {
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                return false;
            }
        }
        return true;
    }

    return {
        validationTypes: validationTypes,
        runCallBack: runCallBack,
        isSameObject: isSameObject,
        isEmpty: isEmpty,
        cloneExtend: cloneExtend,
        clone: clone,
        stringify: stringify,
        existsInEnum: existsInEnum,
        validateCondition: validateCondition,
        validateConditions: validateConditions,
        getProperty: getProperty,
        getValues: getValues,
        remodel: remodel,
        templateStrings: templateStrings,
        overRideMerge: overRideMerge,
        error: error,
        debug: debug,
        info: info,
        log: log,
        getUID: getUID
    };
};
