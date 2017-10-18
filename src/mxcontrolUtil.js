const sizesRC = "../consts/AWSEC2Sizes.json";

const namesRC = "../config/instanceNamePrefixes.json";
const fs      = require("fs");
const log     = require("./logUtil.js").log;

const tryToParseConfig = exports.tryToParseConfig = (filename, isOptional) => {
    const dir = `${__dirname}/${filename}`;
    try {
        return JSON.parse(fs.readFileSync(`${dir}`, "utf-8"));
    }
    catch (err) {
        if (isOptional) return;
        log.error(`${dir} was not found, or is malformed JSON.`);
        log.error(`Please double check it exists, and verify that it is well formed JSON.`);
        log.error("Exiting.");
        process.exit(1);
    }
};

const upVerbs       = new Set(["on","up","start"]);
const downVerbs     = new Set(["down","off","stop"]);
const rebootVerbs   = new Set(["restart","reboot"]);
const resizeVerbs   = new Set(["resize"]);
const helpVerbs     = new Set(["help"]);
const cronTimeVerbs = new Set(["auto", "cron"]);
const statusVerbs   = new Set(["status", "info"]);

let protoPossibleActions = {
    upVerbs:        upVerbs,
    downVerbs:      downVerbs,
    rebootVerbs:    rebootVerbs,
    resizeVerbs:    resizeVerbs,
    helpVerbs:      helpVerbs,
    cronTimeVerbs:  cronTimeVerbs,
    statusVerbs:    statusVerbs
};

let allPossibleActionArray =
    Object.values(protoPossibleActions).reduce((acc,val) => {
        acc.push(...val);
        return acc;
    },[]);

const allPossibleActions = new Set(allPossibleActionArray);

exports.possibleActions = Object.assign(protoPossibleActions, {allPossibleActions: allPossibleActions});
exports.possibleSizes = new Set(tryToParseConfig(sizesRC));

//Optionally adds DBPrefix to string, if needed.
const {DBPrefix} = tryToParseConfig(namesRC);
exports.fixRDSName = (name) =>{
    if (!name || name == true) return;
    let target = "".concat(DBPrefix);

    //if it doesnt start with mxenvironment, add it
    if (name.substr(0, target.length) != target && name != "*"){
        target = target.concat(name);
    }

    else {
        target = "".concat(name);
    }

    return target;
};

return exports;
