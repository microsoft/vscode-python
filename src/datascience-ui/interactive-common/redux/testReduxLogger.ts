// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as fs from 'fs-extra';
import * as path from 'path';
import { noop } from '../../../client/common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';

// This logger will log console output to a file instead the console.
export class TestReduxLogger {
    // tslint:disable: no-any
    public memory: any;
    private logStream: fs.WriteStream | undefined;
    constructor() {
        this.createLogStream();
    }
    public assert(condition?: boolean | undefined, message?: string | undefined, ...data: any[]): void;
    public assert(value: any, message?: string | undefined, ...optionalParams: any[]): void;
    public assert(_value?: any, _message?: any, ..._doptionalParams: any[]) {
        // Skip asserts
        noop();
    }
    public clear(): void;
    public clear(): void;
    public clear() {
        this.closeLogStream().then(() => this.createLogStream());
    }
    public count(label?: string | undefined): void;
    public count(label?: string | undefined): void;
    public count(label?: any) {
        throw new Error('Method not implemented.');
    }
    public debug(message?: any, ...optionalParams: any[]): void;
    public debug(message?: any, ...optionalParams: any[]): void;
    public debug(message?: any, ...optionalParams: any[]) {
        throw new Error('Method not implemented.');
    }
    public dir(value?: any, ...optionalParams: any[]): void;
    public dir(obj: any, options?: NodeJS.InspectOptions | undefined): void;
    public dir(obj?: any, options?: any, ...rest: any[]) {
        throw new Error('Method not implemented.');
    }
    public dirxml(value: any): void;
    public dirxml(...data: any[]): void;
    public dirxml(value?: any, ...rest: any[]) {
        throw new Error('Method not implemented.');
    }
    public error(message?: any, ...optionalParams: any[]): void;
    public error(message?: any, ...optionalParams: any[]): void;
    public error(message?: any, ...optionalParams: any[]) {
        throw new Error('Method not implemented.');
    }
    public exception(message?: string | undefined, ...optionalParams: any[]): void {
        throw new Error('Method not implemented.');
    }
    public group(groupTitle?: string | undefined, ...optionalParams: any[]): void;
    public group(...label: any[]): void;
    public group(groupTitle?: any, ...optionalParams: any[]) {
        throw new Error('Method not implemented.');
    }
    public groupCollapsed(groupTitle?: string | undefined, ...optionalParams: any[]): void;
    public groupCollapsed(): void;
    public groupCollapsed(groupTitle?: any, ...optionalParams: any[]) {
        throw new Error('Method not implemented.');
    }
    public groupEnd(): void;
    public groupEnd(): void;
    public groupEnd() {
        throw new Error('Method not implemented.');
    }
    public info(message?: any, ...optionalParams: any[]): void;
    public info(message?: any, ...optionalParams: any[]): void;
    public info(message?: any, ...optionalParams: any[]) {
        throw new Error('Method not implemented.');
    }
    public log(message?: any, ...optionalParams: any[]): void;
    public log(message?: any, ...optionalParams: any[]): void;
    public log(message?: any, ...optionalParams: any[]) {
        throw new Error('Method not implemented.');
    }
    public markTimeline(label?: string | undefined): void;
    public markTimeline(label?: string | undefined): void;
    public markTimeline(label?: any) {
        throw new Error('Method not implemented.');
    }
    public profile(reportName?: string | undefined): void;
    public profile(label?: string | undefined): void;
    public profile(label?: any) {
        throw new Error('Method not implemented.');
    }
    public profileEnd(reportName?: string | undefined): void;
    public profileEnd(label?: string | undefined): void;
    public profileEnd(label?: any) {
        throw new Error('Method not implemented.');
    }
    public table(...tabularData: any[]): void;
    public table(tabularData: any, properties?: string[] | undefined): void;
    public table(tabularData?: any, properties?: any, ...rest: any[]) {
        throw new Error('Method not implemented.');
    }
    public time(label?: string | undefined): void;
    public time(label?: string | undefined): void;
    public time(label?: any) {
        throw new Error('Method not implemented.');
    }
    public timeEnd(label?: string | undefined): void;
    public timeEnd(label?: string | undefined): void;
    public timeEnd(label?: any) {
        throw new Error('Method not implemented.');
    }
    public timeStamp(label?: string | undefined): void;
    public timeStamp(label?: string | undefined): void;
    public timeStamp(label?: any) {
        throw new Error('Method not implemented.');
    }
    public timeline(label?: string | undefined): void;
    public timeline(label?: string | undefined): void;
    public timeline(label?: any) {
        throw new Error('Method not implemented.');
    }
    public timelineEnd(label?: string | undefined): void;
    public timelineEnd(label?: string | undefined): void;
    public timelineEnd(label?: any) {
        throw new Error('Method not implemented.');
    }
    public trace(message?: any, ...optionalParams: any[]): void;
    public trace(message?: any, ...optionalParams: any[]): void;
    public trace(message?: any, ...optionalParams: any[]) {
        throw new Error('Method not implemented.');
    }
    public warn(message?: any, ...optionalParams: any[]): void;
    public warn(message?: any, ...optionalParams: any[]): void;
    public warn(message?: any, ...optionalParams: any[]) {
        throw new Error('Method not implemented.');
    }
    public countReset(label?: string | undefined): void {
        throw new Error('Method not implemented.');
    }
    public timeLog(label?: string | undefined, ...data: any[]): void {
        throw new Error('Method not implemented.');
    }
    private write(message?: any, ...optionalParams: any[]): void {
        if (this.logStream) {
            this.logStream.write(message);
        }
    }
    private closeLogStream(): Promise<void> {
        return new Promise((resolve, _reject) => {
            if (this.logStream) {
                this.logStream.on('finished', resolve);
                this.logStream.close();
                this.logStream.end();
                this.logStream = undefined;
            } else {
                resolve();
            }
        });
    }
    private createLogStream() {
        const logFileEnv = process.env.VSC_PYTHON_WEBVIEW_LOG_FILE;
        if (logFileEnv) {
            const logFilePath = path.isAbsolute(logFileEnv) ? logFileEnv : path.join(EXTENSION_ROOT_DIR, logFileEnv);
            this.logStream = fs.createWriteStream(logFilePath, { flags: 'w', encoding: 'utf-8', autoClose: true });
        }
    }
}
