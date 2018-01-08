//A simplified external API -- use these functions for
//using in other scripts

//Update this when you introduce a new import.

const {
    getControlTaskErrors,
    controlTaskIsValid,
    displayErrorsAndFailScript
} = require("./controlTaskValidator.js");

const {engageCronTasks} = require("./cronPower.js");

const {log, logCatch} = require("./logUtil.js");

const {
    tryToParseConfig,
    possibleActions,
    possibleSizes
} = require("./mxcontrolUtil");

const {
    runTask,
    buildPowerFunc,
    statusEC2,
    statusRDS,
    statusEnv,
    buildLog
} = require("./routes.js")

exports.getControlTaskErrors = getControlTaskErrors;
exports.controlTaskIsValid = controlTaskIsValid;
exports.displayErrorsAndFailScript = displayErrorsAndFailScript;

exports.engageCronTasks = engageCronTasks;

exports.log = log;
exports.logCatch = logCatch;

exports.tryToParseConfig = tryToParseConfig;
exports.possibleActions = possibleActions;
exports.possibleSizes = possibleSizes;

exports.runTask = runTask;
exports.buildPowerFunc = buildPowerFunc;
exports.statusEC2 = statusEC2;
exports.statusRDS = statusRDS;
exports.statusEnv = statusEnv;
exports.buildLog = buildLog;

return exports;
