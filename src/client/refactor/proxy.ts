'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';
import { IPythonSettings } from '../common/configSettings';
import { REFACTOR } from '../common/telemetryContracts';
import { getCustomEnvVars, getCustomEnvVarsSync, getWindowsLineEndingCount, IS_WINDOWS } from '../common/utils';
import { mergeEnvVariables } from '../common/envFileParser';

export class RefactorProxy extends vscode.Disposable {
    private _process: child_process.ChildProcess;
    private _extensionDir: string;
    private _previousOutData: string = '';
    private _previousStdErrData: string = '';
    private _startedSuccessfully: boolean = false;
    private _commandResolve: (value?: any | PromiseLike<any>) => void;
    private _commandReject: (reason?: any) => void;
    private _initializeReject: (reason?: any) => void;
    constructor(extensionDir: string, private pythonSettings: IPythonSettings, private workspaceRoot: string) {
        super(() => { });
        this._extensionDir = extensionDir;
    }

    dispose() {
        try {
            this._process.kill();
        }
        catch (ex) {
        }
        this._process = null;
    }
    private getOffsetAt(document: vscode.TextDocument, position: vscode.Position): number {
        if (!IS_WINDOWS) {
            return document.offsetAt(position);
        }

        // get line count
        // Rope always uses LF, instead of CRLF on windows, funny isn't it
        // So for each line, reduce one characer (for CR)
        // But Not all Windows users use CRLF
        const offset = document.offsetAt(position);
        const winEols = getWindowsLineEndingCount(document, offset);

        return offset - winEols;
    }
    rename<T>(document: vscode.TextDocument, name: string, filePath: string, range: vscode.Range, options?: vscode.TextEditorOptions): Promise<T> {
        if (!options) {
            options = vscode.window.activeTextEditor.options;
        }
        let command = {
            "lookup": "rename",
            "file": filePath,
            "start": this.getOffsetAt(document, range.start).toString(),
            "id": "1",
            "name": name,
            "indent_size": options.tabSize
        };

        return this.sendCommand<T>(JSON.stringify(command), REFACTOR.Rename);
    }
    extractVariable<T>(document: vscode.TextDocument, name: string, filePath: string, range: vscode.Range, options?: vscode.TextEditorOptions): Promise<T> {
        if (!options) {
            options = vscode.window.activeTextEditor.options;
        }
        let command = {
            "lookup": "extract_variable",
            "file": filePath,
            "start": this.getOffsetAt(document, range.start).toString(),
            "end": this.getOffsetAt(document, range.end).toString(),
            "id": "1",
            "name": name,
            "indent_size": options.tabSize
        };
        return this.sendCommand<T>(JSON.stringify(command), REFACTOR.ExtractVariable);
    }
    extractMethod<T>(document: vscode.TextDocument, name: string, filePath: string, range: vscode.Range, options?: vscode.TextEditorOptions): Promise<T> {
        if (!options) {
            options = vscode.window.activeTextEditor.options;
        }
        // Ensure last line is an empty line
        if (!document.lineAt(document.lineCount - 1).isEmptyOrWhitespace && range.start.line === document.lineCount - 1) {
            return Promise.reject<T>('Missing blank line at the end of document (PEP8).');
        }
        let command = {
            "lookup": "extract_method",
            "file": filePath,
            "start": this.getOffsetAt(document, range.start).toString(),
            "end": this.getOffsetAt(document, range.end).toString(),
            "id": "1",
            "name": name,
            "indent_size": options.tabSize
        };
        return this.sendCommand<T>(JSON.stringify(command), REFACTOR.ExtractMethod);
    }
    private sendCommand<T>(command: string, telemetryEvent: string): Promise<T> {
        return this.initialize(this.pythonSettings.pythonPath).then(() => {
            return new Promise<T>((resolve, reject) => {
                this._commandResolve = resolve;
                this._commandReject = reject;
                this._process.stdin.write(command + '\n');
            });
        });
    }
    private initialize(pythonPath: string): Promise<string> {
        return new Promise<any>((resolve, reject) => {
            this._initializeReject = reject;
            let environmentVariables = { 'PYTHONUNBUFFERED': '1' };
            let customEnvironmentVars = getCustomEnvVarsSync(vscode.Uri.file(this.workspaceRoot));
            if (customEnvironmentVars) {
                environmentVariables = mergeEnvVariables(environmentVariables, customEnvironmentVars);
            }
            environmentVariables = mergeEnvVariables(environmentVariables);
            this._process = child_process.spawn(pythonPath, ['refactor.py', this.workspaceRoot],
                {
                    cwd: path.join(this._extensionDir, 'pythonFiles'),
                    env: environmentVariables
                });
            this._process.stderr.setEncoding('utf8');
            this._process.stderr.on('data', this.handleStdError.bind(this));
            this._process.on('error', this.handleError.bind(this));

            let that = this;
            this._process.stdout.setEncoding('utf8');
            this._process.stdout.on('data', (data: string) => {
                let dataStr: string = data + '';
                if (!that._startedSuccessfully && dataStr.startsWith('STARTED')) {
                    that._startedSuccessfully = true;
                    return resolve();
                }
                that.onData(data);
            });
        });
    }
    private handleStdError(data: string) {
        // Possible there was an exception in parsing the data returned
        // So append the data then parse it
        let dataStr = this._previousStdErrData = this._previousStdErrData + data + '';
        let errorResponse: { message: string, traceback: string, type: string }[];
        try {
            errorResponse = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
            this._previousStdErrData = '';
        }
        catch (ex) {
            console.error(ex);
            // Possible we've only received part of the data, hence don't clear previousData
            return;
        }
        if (typeof errorResponse[0].message !== 'string' || errorResponse[0].message.length === 0) {
            errorResponse[0].message = errorResponse[0].traceback.split(/\r?\n/g).pop();
        }
        let errorMessage = errorResponse[0].message + '\n' + errorResponse[0].traceback;

        if (this._startedSuccessfully) {
            this._commandReject(`Refactor failed. ${errorMessage}`);
        }
        else {
            if (typeof errorResponse[0].type === 'string' && errorResponse[0].type === 'ModuleNotFoundError') {
                this._initializeReject('Not installed');
                return;
            }

            this._initializeReject(`Refactor failed. ${errorMessage}`);
        }
    }
    private handleError(error: Error) {
        if (this._startedSuccessfully) {
            return this._commandReject(error);
        }
        this._initializeReject(error);
    }
    private onData(data: string) {
        if (!this._commandResolve) { return; }

        // Possible there was an exception in parsing the data returned
        // So append the data then parse it
        let dataStr = this._previousOutData = this._previousOutData + data + '';
        let response: any;
        try {
            response = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
            this._previousOutData = '';
        }
        catch (ex) {
            // Possible we've only received part of the data, hence don't clear previousData
            return;
        }
        this.dispose();
        this._commandResolve(response[0]);
        this._commandResolve = null;
    }
}
