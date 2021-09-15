import * as logform from 'logform';
import * as path from 'path';
import * as winston from 'winston';
import * as Transport from 'winston-transport';

const folderPath = path.dirname(__dirname);
const folderName = path.basename(folderPath);
const EXTENSION_ROOT_DIR =
    folderName === 'client' ? path.join(folderPath, '..', '..') : path.join(folderPath, '..', '..', '..', '..');

// Create a file-targeting transport that can be added to a winston logger.
export function getFileTransport(logfile: string, formatter: logform.Format): Transport {
    if (!path.isAbsolute(logfile)) {
        logfile = path.join(EXTENSION_ROOT_DIR, logfile);
    }
    return new winston.transports.File({
        format: formatter,
        filename: logfile,
        handleExceptions: true,
    });
}

export * from './consoleTransport';
export * from './pythonOutputChannelTransport';
