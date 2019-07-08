/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from 'util';
import { createLogger, format, Logger as WinstonLogger, transports } from 'winston';
import { Logger as ILogger } from '../../../../out/smoke/vscode/logger';

const formatter = format.printf(({ level, message, timestamp }) => {
    // Pascal casing og log level, so log files get highlighted when viewing in VSC and other editors.
    return `${level.substring(0, 1).toUpperCase()}${level.substring(1)} ${timestamp}: ${message}`;
});
const logFormat = format.combine(
    format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    formatter
);

export class Logger implements ILogger {
    private readonly logger: WinstonLogger;
    constructor(logFile: string) {
        this.logger = createLogger();
        this.logger.add(new transports.File({
            format: logFormat,
            filename: logFile
        }));
        // this.logger.add(new transports.Console({
        //     format: logFormat
        // }));
    }

    // tslint:disable-next-line: no-any
    public log(message: string, ...args: any[]): void {
        this.logger.log('info', util.format(message, ...args));
    }
}
