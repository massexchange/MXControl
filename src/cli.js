#!/usr/bin/env node

const {controlTaskIsValid, displayErrorsAndFailScript} = require(`${__dirname}/controlTaskValidator.js`);

const {logCatch}            = require(`${__dirname}/logUtil.js`);
const runTask               = require(`${__dirname}/routes.js`).runTask;
const engageCronTasks       = require(`${__dirname}/cronPower.js`).engageCronTasks;
const args                  = require("minimist")(process.argv.slice(2));

const {possibleActions} = require("./mxcontrolUtil.js");
const {cronTimeVerbs, helpVerbs} = possibleActions;

const main = async (minimistArgs) => {
    if (!argumentsAreGood(minimistArgs))
        return;

    const controlTask = convertArgumentsToControlTask(minimistArgs);

    if (!await controlTaskIsValid(controlTask))
        return;

    if (cronTimeVerbs.has(controlTask.action)){
        await engageCronTasks();
    } else await runTask(controlTask);
};

const argumentsAreGood = (minimistArgs) => {
    let errors = getArgumentFormatErrors(minimistArgs);
    if (errors && errors.length != 0)
        return displayErrorsAndFailScript([{task: args, errors: errors}]);
    return true;
};

const convertArgumentsToControlTask = (minimistArgs) => {
    let action = {action: minimistArgs._[0]};
    if (cronTimeVerbs.has(action.action) || helpVerbs.has(action.action))
        return action;

    if ("size" in minimistArgs)
        action = Object.assign({size: minimistArgs.size}, action);

    if ("env" in minimistArgs)
        return Object.assign({environment: minimistArgs.env}, action);
    if ("inst" in minimistArgs)
        return Object.assign({instance: minimistArgs.inst}, action);
    if ("db" in minimistArgs)
        return Object.assign({database: minimistArgs.db}, action);
};

//If the format of the arguments is good, return blank array. Else, log and fail at life.
const getArgumentFormatErrors = (minimistArgs) => {
    let errors = [];
    const {_ : action} = minimistArgs;
    const validTargetFlags = new Set(["env", "inst", "db"]);

    const givenFlags = Object.keys(minimistArgs);

    const badFlags = givenFlags.filter(key =>
        !validTargetFlags.has(key) && key != "_" && key != "size");

    if (action.length != 1)
        errors.push(`More than a single action was given: ${minimistArgs._}`);

    if (badFlags.length != 0)
        errors.push(`The following option flags are invalid: ${badFlags}`);

    if (hasAtLeastTwoInCommon(new Set(givenFlags), validTargetFlags))
        errors.push(`Multiple target-type commands are invalid.`);

    return errors;
};

//Counts the number of common elements between two NATIVE JS SETS.
const countCommonElements = (s1, s2) =>
    [...s1].reduce( ((agg, curr) => s2.has(curr) ? ++agg : agg), 0);

const hasAtLeastTwoInCommon = (s1, s2) =>
    countCommonElements(s1, s2) >= 2;

main(args).catch(logCatch);
