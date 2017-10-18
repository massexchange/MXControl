const winston = require("winston");

const formatLeadingZero = (num) => {
    if (num >= 10 || num < -10) {
        return num;
    }
    else if (num >= 0){
        return `0${num}`;
    }
    else if (num < 0){
        return `-0${num*-1}`;
    }
};

const generateTimestamp = () => {
    const date = new Date();

    const MO = formatLeadingZero(date.getMonth()+1);
    const D = formatLeadingZero(date.getDate());
    const Y = date.getFullYear();
    const H = formatLeadingZero(date.getHours());
    const MIN = formatLeadingZero(date.getMinutes());
    const S = formatLeadingZero(date.getSeconds());

    const TZ = date.getTimezoneOffset() != 0 ?
        formatLeadingZero(date.getTimezoneOffset()/60) :
        "UTC";

    return `${MO}/${D}/${Y} | ${H}:${MIN}:${S} (${TZ})`;
};

const formatLogPrefix = (options) => {
    const timestamp = generateTimestamp();
    const loglevel = options.level.toUpperCase();
    const message = options.message;
    return `[ ${timestamp} ] | [${loglevel}]: ${message}`;
};

const WinstonConsoleLogTransport = new winston.transports.Console({formatter: formatLogPrefix});

const log = exports.log = new winston.Logger({transports:[WinstonConsoleLogTransport]});

const logCatch = exports.logCatch = err => log.error(err.stack.toString());

return exports;
