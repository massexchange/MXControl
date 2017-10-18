const tasksRC = "cronTaskList.json";

const later = require("later");

const buildPowerFunc     = require(`${__dirname}/routes.js`).buildPowerFunc;
const log                = require(`${__dirname}/logUtil.js`).log;
const tryToParseConfig   = require("./mxcontrolUtil.js").tryToParseConfig;
const {getControlTaskErrors, displayErrorsAndFailScript} = require("./controlTaskValidator.js");


//consider this "main"
exports.engageCronTasks = async () => {
    const controlTasks = await tryToParseConfig(tasksRC);
    const taskErrors = await getControlTaskErrors(controlTasks, true); //true means validate a time field too
    if (taskErrors.length != 0) return displayErrorsAndFailScript(taskErrors);
    processAndActivateTasks(controlTasks); // PROCESS MAY EXIT HERE
    log.info("Scheduled Power Control Jobs Active.");
};

const processAndActivateTasks = (taskInfo) => {
    later.date.UTC();
    return taskInfo.map(task => {
        let schedule = buildLaterScheduleOrFail(task);

        if (schedule == false) // if we have a bad schedule, f*** the entire process + its events.
            process.exit(1);

        return later.setInterval(buildPowerFunc(task), schedule);
    });
};

const buildLaterScheduleOrFail = (task) => {
    const schedule = later.parse.text(task.time);

    //No errors -- is proper Later.js text
    if (schedule.error == -1)
        return schedule;

    //First character in error -- heuristic for "it's a cron-string"
    else if (schedule.error == 0)
        return later.parse.cron(task.time, true);   //TODO: On next pass, validate this cron.

    //Errors. Failed to build, now fail.
    else {
        //First, lets build a convienient little pointer to tell our user where they goofed.
        let errorIndicator = "";
        let errorPos = schedule.error;
        while (errorPos-- != 0) errorIndicator += " ";
        errorIndicator += "^";

        //Then build and do error stuff.
        const errorArray = [
            "There was an error parsing the given time field.",
            "Error Position:",
            task.time,
            errorIndicator
        ];
        return displayErrorsAndFailScript([{task: task, errors: errorArray}]);
    }
};


return exports;
