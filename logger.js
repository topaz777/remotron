const winston = require('winston');
require('winston-daily-rotate-file');
require('date-utils');

const logger = winston.createLogger({
    level: 'debug',
    transports: [
        new winston.transports.DailyRotateFile({
            dirname: './log',
            filename: 'monitor.log',
            zippedArchive: false,
            maxFiles: '14d',
            format: winston.format.printf(
                info => `${new Date().toFormat('HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
        }),
        new winston.transports.Console({
            format: winston.format.printf(
                info => `${new Date().toFormat('HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
        })
    ]
});
module.exports = logger;
