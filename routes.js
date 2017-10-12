const dbInfRC = "dbPowerDefaults.json";
const namesRC = "instanceNamePrefixes.json";

const {mxaws}         = require("mxaws");
const util            = require("./mxcontrolUtil.js");
const {log, logCatch} = require("./logUtil.js");

const marked                    = require("marked");
const markedTerminalRenderer    = require("marked-terminal");
const fs                        = require("fs");

marked.setOptions({renderer: new markedTerminalRenderer()});

const {tryToParseConfig, possibleActions}   = util;
const {dbDefaultUp, dbDefaultDown}          = tryToParseConfig(dbInfRC);

const { upVerbs, downVerbs, rebootVerbs,
        resizeVerbs, statusVerbs, helpVerbs,
        cronTimeVerbs } = possibleActions;

//consider this function this file's "main"
//the other exported functions are the status funcs: statusEC2, statusRDS, and statusEnv
exports.runTask = async (controlTask) => {
    let {instance, environment, database, action} = controlTask;
    if (statusVerbs.has(action)){
        // If this is only a status call, just deal with it
        let output;
        if ("instance" in controlTask){
            output = (instance == true)
            ? await statusEC2().catch(logCatch)
            : await statusEC2(instance).catch(logCatch);
        }

        if ("environment" in controlTask){
            output = (environment == true)
            ? await statusEnv().catch(logCatch)
            : await statusEnv(environment).catch(logCatch);
        }

        if ("database" in controlTask){
            output = (database == true)
            ? await statusRDS().catch(logCatch)
            : await statusRDS(database).catch(logCatch);
        }
        console.log(output) //eslint-disable-line

        return;
    }

    //Deliberately not an if...else chain. Keep reading.
    if (environment){
        const {FEPrefix, BEPrefix, DBPrefix} = tryToParseConfig(namesRC);
        instance = [];
        database = [];
        if (!Array.isArray(environment)) environment = [environment];
        environment.forEach(env => {
            instance.push(`${FEPrefix}${env}`);
            instance.push(`${BEPrefix}${env}`);
            database.push(`${DBPrefix}${env}`);
        });
    }

    if (database) {
        if (!Array.isArray(database)) database = [database];
        let {action, size} = convertDBControlTaskToResizeTask(controlTask);
        await Promise.all(database.map(db =>
            logAndDoAction(db, action, size, true).catch(logCatch)));
    }

    if (instance) {
        if (!Array.isArray(instance)) instance = [instance];
        let {action, size} = controlTask;
        await logAndDoAction(instance, action, size).catch(logCatch);
    }

    if (helpVerbs.has(action))
        console.log(marked(fs.readFileSync(`${__dirname}/README.md`, "utf-8"))); // eslint-disable-line

};

exports.buildPowerFunc = (controlTask) => {
    return async () => exports.runTask(controlTask);
};

const statusEC2 = exports.statusEC2 = async (targetName, isEnvironment) => {
    if (Array.isArray(targetName))
        return await Promise.all(targetName.map(name => statusEC2(name, isEnvironment)));

    const data = (isEnvironment
        ? await mxaws.getEC2InstancesByEnvironment([targetName])
        : await mxaws.getEC2InstanceByName(targetName))
            .Reservations.map(res => res.Instances[0]);

    const activeInstances = data.filter(datum => datum.State.Name != "terminated");

    return activeInstances.map(inst => {
        let instName = inst.Tags.filter(tag => tag.Key == "Name")[0].Value;
        let instApp = inst.Tags.filter(tag => tag.Key == "Application")[0].Value;
        let instEnv = inst.Tags.filter(tag => tag.Key == "Environment")[0].Value;
        return {
            InstanceName:       instName,
            InstanceState:      inst.State.Name,
            InstanceApplication:(instApp ? instApp : "db"),
            InstanceEnvironment:instEnv,
            InstanceAddress:    inst.PublicIpAddress,
            InstanceSize:       inst.InstanceType,
            InstanceId:         inst.InstanceId
        };
    });
};


const statusRDS = exports.statusRDS = async (targetDB) => {

    if (Array.isArray(targetDB))
        return await Promise.all(targetDB.map(db => statusRDS(db)));

    const data = (await mxaws.getRDSInstance(util.fixRDSName(targetDB)));
    const dbs = data.DBInstances;
    return dbs.map(db => {
        return {
            InstanceName:       db.DBInstanceIdentifier,
            InstanceState:      db.DBInstanceStatus,
            InstanceAddress:    db.Endpoint.Address,
            InstanceSize:       db.DBInstanceClass,
        };
    });
};

const statusEnv = exports.statusEnv = async (envName) => {
    return await Promise.all([
        statusEC2(envName, true),
        statusRDS(envName)
    ]);
};

const convertDBControlTaskToResizeTask = (controlTask) => {
    if (upVerbs.has(controlTask.action))
        return Object.assign({}, controlTask, {action:"resize", size:dbDefaultUp});
    if (downVerbs.has(controlTask.action))
        return Object.assign({}, controlTask, {action:"resize", size:dbDefaultDown});
    return controlTask;
};

//EC2 ids or RDS Identifiers aka regular full db names
//Either Or, NOT BOTH TYPES.
const logAndDoAction = async (targetNames, action, size, isDBop) => {
    if (!statusVerbs.has(action))
        log.info(buildInitLog(targetNames, action, size, isDBop));
    if (!isDBop){
        const EC2Instances = await statusEC2();
        let targetIds = getEC2IdArrayFromNameArray(targetNames, EC2Instances);
        await doEC2ActionAndWait(targetIds, action, size);
    } else {
        await doRDSActionAndWait(targetNames, action, size);
    }
    log.info(`${isDBop ? "RDS" :"EC2"} '${action}' job on ${targetNames} completed.`);
};

exports.buildLog = const buildInitLog = (targetNames, action, size, isDBop) => {
    if (rebootVerbs.has(action))
        return `Rebooting: ${targetNames}`;

    else if (resizeVerbs.has(action)){
        return `Resizing ${targetNames} to ${size}`;
    }

    else if (!isDBop && !statusVerbs.has(action)){
        const prefix = (possibleActions.upVerbs.has(action)) ? "Starting" : "Stopping";
        return `${prefix} the following: ${targetNames}`;
    }
};

const getEC2IdArrayFromNameArray = (nameArray, EC2Instances) => {
    return nameArray.map(name => {
        return EC2Instances.reduce((goodID, inst) => {
            if (inst.InstanceName == name) goodID = inst.InstanceId;
            return goodID;
        }, "");
    });
};

const waitForEC2InstanceArrayAvailable = (ec2InstIDArray, action) => {
    if (downVerbs.has(action)) return mxaws.waitForEC2InstanceArrayShutdown(ec2InstIDArray);
    return mxaws.waitForEC2InstanceArrayStartup(ec2InstIDArray);
}

//ASSUMES PREVALIDATION
const doEC2ActionAndWait = async (targetIdArray, action, size) => {
    if (rebootVerbs.has(action))
        await mxaws.rebootEC2InstancesByInstanceIdArray(targetIdArray);

    else if (upVerbs.has(action))
        await mxaws.startEC2InstancesByInstanceIdArray(targetIdArray);

    else if (downVerbs.has(action))
        await mxaws.stopEC2InstancesByInstanceIdArray(targetIdArray);

    else if (resizeVerbs.has(action)){
        await mxaws.resizeEC2InstancesByInstanceIdArray(targetIdArray, size);
        return; //EC2 resize handles its own waiting internally.
    }

    await mxaws.delay(10);
    await waitForEC2InstanceArrayAvailable(targetIdArray, action);
};

//ASSUMES PREVALIDATION AND PRECONVERSION FROM ON/OFFS TO RESIZES
const doRDSActionAndWait = async (dbIdentifier, action, size) => {

    if (Array.isArray(dbIdentifier))
        return await Promise.all(dbIdentifier.map(db => doRDSActionAndWait(db, action, size)));

    else if (rebootVerbs.has(action))
        await mxaws.rebootRDSInstance(dbIdentifier);

    else if (resizeVerbs.has(action))
        await mxaws.resizeRDSInstance(dbIdentifier, size);

    await mxaws.delay(30);
    await mxaws.waitForRDSInstanceAvailable(dbIdentifier);
};



return exports;
