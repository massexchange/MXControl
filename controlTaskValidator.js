const dbInfRC = "instanceNamePrefixes.json";

const log    = require(`${__dirname}/logUtil.js`).log;
const Routes = require("./routes.js");
const util   = require("./mxcontrolUtil.js");

const {tryToParseConfig}               = util;
const {possibleActions, possibleSizes} = util;
const {FEPrefix, BEPrefix, DBPrefix}   = tryToParseConfig(dbInfRC);

const { resizeVerbs, allPossibleActions, helpVerbs, cronTimeVerbs, statusVerbs } =
    possibleActions;


const getControlTaskErrors = exports.getControlTaskErrors = async (inputTasks, isTimeMandatory) => {

    const tasks = Array.isArray(inputTasks)
        ? inputTasks
        : [inputTasks];

    const [EC2Instances, RDSInstances] = await Promise.all([Routes.statusEC2(), Routes.statusRDS()]);

    //Currently, just checks for presence.
    const getTimeErrors = task => {
        let errors = [];
        if (!isTimeMandatory) return errors;
        if (!("time" in task)) errors.push("Time does not exist!");
        return errors;
    };

    const isTaskTargetAWildcard = (task) => {
        const isTaskTargetWildcard = (propToCheck) => propIsBoolAndTrue(task, propToCheck);
        return isTaskTargetWildcard("environment")
        || isTaskTargetWildcard("instance")
        || isTaskTargetWildcard("database");
    };

    const propIsBoolAndTrue = (obj, propToCheck) => obj[propToCheck] == true;

    const getActionErrors = (task) => {
        let errors = [];
        const {action, size} = task;

        if (typeof action != "string")
            errors.push(`Given action ${action} is not a string.`);

        if (!allPossibleActions.has(action))
            errors.push(`Action ${action} is not a valid actionVerb!`);

        if (!resizeVerbs.has(action) && typeof size == "string")
            errors.push(
                `Task given includes a size ${size},
                but action ${action} is not a valid resizeVerb`);

        if ("environment" in task && resizeVerbs.has(action))
            errors.push("Cannot resize an environment -- resize individual instances instead.");

        let isValidSize = possibleSizes.has(size) || possibleSizes.has(`db.${size}`);
        if (resizeVerbs.has(action) && !isValidSize)
            errors.push(`Size ${size} is not a valid EC2/RDS size!`);

        let helpOrCronAction = helpVerbs.has(action) || cronTimeVerbs.has(action);
        let possibleTargetPresent = ("environment" in task || "instance" in task || "database" in task);

        if (!helpOrCronAction && !possibleTargetPresent)
            errors.push(`Action ${action} requires a target!`);
        if (helpOrCronAction && possibleTargetPresent)
            errors.push(`Action ${action} accepts no target!`);

        if (!statusVerbs.has(action) && isTaskTargetAWildcard(task) )
            errors.push(`Only status actions can utilize wildcards, for your own safety.`);

        return errors;
    };

    const getTargetErrors = (task) => {

        if (isTaskTargetAWildcard(task))
            return;

        else if ("environment" in task && task.environment != true){

            if (Array.isArray(task.environment))
                return task.environment.reduce((agg, curr) => {
                    let retVal = getErrorLogIfFullEnvDoesNotExist(curr, EC2Instances, RDSInstances);
                    if (retVal) return agg.concat(retVal);
                    else return agg;
                }, []);

            else {
                let retVal =
                    getErrorLogIfFullEnvDoesNotExist(task.environment, EC2Instances, RDSInstances);
                if (retVal) return retVal;
            }
        }

        else if ("instance" in task || "database" in task){
            const target = task.instance || task.database;
            const allTargets = EC2Instances.concat(RDSInstances);

            if (Array.isArray(target)) {
                return target.reduce((agg, curr) => {
                    let retVal = makeErrIfAWSInstNameNotFound(curr, allTargets);
                    if (retVal) return agg.concat(retVal);
                    else return agg;
                }, []);
            }

            else {
                let retVal = makeErrIfAWSInstNameNotFound(target, allTargets);
                if (retVal) return retVal;
            }
        }
    };

    //Returns empty array if no errors, otherwise array of strings of errors.
    const getErrorLogIfFullEnvDoesNotExist = (envName, EC2Instances, RDSInstances) => {
        const errors = [];
        const EC2EnvErrors = getErrIfFullEC2EnvNotFound(envName, EC2Instances);
        const RDSNotFound = makeErrIfAWSInstNameNotFound(`${DBPrefix}${envName}`, RDSInstances);
        if (EC2EnvErrors.length != 0) errors.push(EC2EnvErrors);
        if (RDSNotFound) errors.push(RDSNotFound);
        return errors;
    };

    //Returns empty array if no errors, otherwise array of strings of errors.
    const getErrIfFullEC2EnvNotFound = (envName, EC2Instances) => {
        const errors = [];
        const EC2Env = EC2Instances.filter(inst => inst.InstanceEnvironment == envName);
        const BEDoesNotExist = makeErrMsgIfValUndefined(`${BEPrefix}${envName}`,"InstanceName", EC2Env);
        const FEDoesNotExist = makeErrMsgIfValUndefined(`${FEPrefix}${envName}`,"InstanceName", EC2Env);
        if (BEDoesNotExist) errors.push(BEDoesNotExist);
        if (FEDoesNotExist) errors.push(FEDoesNotExist);
        return errors;
    };

    //Returns String if error found
    const makeErrIfAWSInstNameNotFound = (instNameOrDBIdentifier, AWSStatusArray) => {
        let retval = makeErrMsgIfValUndefined(instNameOrDBIdentifier, "InstanceName", AWSStatusArray);
        if (retval) return retval;
    };

    //Returns String if error found
    const makeErrMsgIfValUndefined = (value, field, objList) => {
        if (!objList.some(inst => inst[field] == value))
            return `${field} ${value} does not exist!`;
    };

    const getBadTasksWithErrors = (tasks) =>
        tasks.reduce((badTasks, task) => {
            let errors = [];
            const timeErr   = getTimeErrors(task);
            const actErr    = getActionErrors(task);
            const targetErr = getTargetErrors(task);
            if (timeErr.length != 0)    errors = errors.concat(timeErr);
            if (actErr.length != 0)     errors = errors.concat(actErr);
            if (targetErr && targetErr.length != 0)  errors = errors.concat(targetErr);
            if (errors.length != 0)
                badTasks.push({task:task, errors:errors});
            return badTasks;
        }, []);

    return getBadTasksWithErrors(tasks);
};
//END OF MASSIVE CLOSURE

const controlTaskIsValid = exports.controlTaskIsValid = async (controlTask) => { // eslint-disable-line
    let errors = await getControlTaskErrors(controlTask);
    if (errors && errors.length != 0)
        return displayErrorsAndFailScript(errors);
    return true;
};

//Sets process exit code to 1, and returns false.
const displayErrorsAndFailScript = exports.displayErrorsAndFailScript = (errorArray) => {
    log.error("Invalid tasks given.");

    //if they're one deep, loop log those too.
    errorArray.forEach(errorTask => {
        log.error("Given ControlTask:");
        log.error(JSON.stringify(errorTask.task));
        errorTask.errors.forEach(err => {
            if (Array.isArray(err))
                err.forEach(er => log.error(er));
            else log.error(err);
        });
    });

    log.error("Exiting.");
    process.exitCode = 1;
    return false;
};

return exports;
