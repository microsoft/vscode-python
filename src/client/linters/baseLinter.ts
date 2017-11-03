'use strict';
import * as path from 'path';
import { OutputChannel, Uri } from 'vscode';
import * as vscode from 'vscode';
import { IPythonSettings, PythonSettings } from '../common/configSettings';
import { Installer, Product } from '../common/installer';
import { execPythonFile } from './../common/utils';
import { ErrorHandler } from './errorHandlers/main';

// tslint:disable-next-line:variable-name
let NamedRegexp = null;
const REGEX = '(?<line>\\d+),(?<column>\\d+),(?<type>\\w+),(?<code>\\w\\d+):(?<message>.*)\\r?(\\n|$)';

export interface IRegexGroup {
    line: number;
    column: number;
    code: string;
    message: string;
    type: string;
}

export interface ILintMessage {
    line: number;
    column: number;
    code: string;
    message: string;
    type: string;
    severity?: LintMessageSeverity;
    provider: string;
}
export enum LintMessageSeverity {
    Hint,
    Error,
    Warning,
    Information
}

export function matchNamedRegEx(data, regex): IRegexGroup {
    if (NamedRegexp === null) {
        // tslint:disable-next-line:no-require-imports
        NamedRegexp = require('named-js-regexp');
    }

    const compiledRegexp = NamedRegexp(regex, 'g');
    const rawMatch = compiledRegexp.exec(data);
    if (rawMatch !== null) {
        return <IRegexGroup>rawMatch.groups();
    }

    return null;
}

type LinterId = 'flake8' | 'mypy' | 'pep8' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint';
export abstract class BaseLinter {
    // tslint:disable-next-line:variable-name
    public Id: LinterId;
    // tslint:disable-next-line:variable-name
    protected _columnOffset = 0;
    // tslint:disable-next-line:variable-name
    private _errorHandler: ErrorHandler;
    // tslint:disable-next-line:variable-name
    private _pythonSettings: IPythonSettings;
    protected get pythonSettings(): IPythonSettings {
        return this._pythonSettings;
    }
    constructor(id: LinterId, public product: Product, protected outputChannel: OutputChannel) {
        this.Id = id;
        this._errorHandler = new ErrorHandler(this.Id, product, new Installer(), this.outputChannel);
    }
    public isEnabled(resource: Uri) {
        this._pythonSettings = PythonSettings.getInstance(resource);
        const enabledSetting = `${this.Id}Enabled`;
        // tslint:disable-next-line:prefer-type-cast
        return this._pythonSettings.linting[enabledSetting] as boolean;
    }
    public linterArgs(resource: Uri) {
        this._pythonSettings = PythonSettings.getInstance(resource);
        const argsSetting = `${this.Id}Args`;
        // tslint:disable-next-line:prefer-type-cast
        return this._pythonSettings.linting[argsSetting] as string[];
    }
    public isLinterExecutableSpecified(resource: Uri) {
        this._pythonSettings = PythonSettings.getInstance(resource);
        const argsSetting = `${this.Id}Path`;
        // tslint:disable-next-line:prefer-type-cast
        const executablePath = this._pythonSettings.linting[argsSetting] as string;
        return path.basename(executablePath).length > 0 && path.basename(executablePath) !== executablePath;
    }
    public lint(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]> {
        this._pythonSettings = PythonSettings.getInstance(document.uri);
        return this.runLinter(document, cancellation);
    }
    protected getWorkspaceRootPath(document: vscode.TextDocument): string {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspaceRootPath = (workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string') ? workspaceFolder.uri.fsPath : undefined;
        return typeof workspaceRootPath === 'string' ? workspaceRootPath : __dirname;
    }
    protected abstract runLinter(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]>;
    // tslint:disable-next-line:no-any
    protected parseMessagesSeverity(error: string, categorySeverity: any): LintMessageSeverity {
        if (categorySeverity[error]) {
            const severityName = categorySeverity[error];
            switch (severityName) {
                case 'Error':
                    return LintMessageSeverity.Error;
                case 'Hint':
                    return LintMessageSeverity.Hint;
                case 'Information':
                    return LintMessageSeverity.Information;
                case 'Warning':
                    return LintMessageSeverity.Warning;
                default: {
                    if (LintMessageSeverity[severityName]) {
                        // tslint:disable-next-line:no-any
                        return <LintMessageSeverity><any>LintMessageSeverity[severityName];
                    }
                }
            }
        }

        return LintMessageSeverity.Information;
    }
    protected run(command: string, args: string[], document: vscode.TextDocument, cwd: string, cancellation: vscode.CancellationToken, regEx: string = REGEX): Promise<ILintMessage[]> {
        return execPythonFile(document.uri, command, args, cwd, true, null, cancellation).then(data => {
            if (!data) {
                data = '';
            }
            this.displayLinterResultHeader(data);
            const outputLines = data.split(/\r?\n/g);
            return this.parseLines(outputLines, regEx);
        }).catch(error => {
            this.handleError(this.Id, command, error, document.uri);
            return [];
        });
    }
    protected handleError(expectedFileName: string, fileName: string, error: Error, resource: Uri) {
        this._errorHandler.handleError(expectedFileName, fileName, error, resource);
    }

    private parseLine(line: string, regEx: string) {
        const match = matchNamedRegEx(line, regEx);
        if (!match) {
            return;
        }

        // tslint:disable-next-line:no-any
        match.line = Number(<any>match.line);
        // tslint:disable-next-line:no-any
        match.column = Number(<any>match.column);

        return {
            code: match.code,
            message: match.message,
            column: isNaN(match.column) || match.column === 0 ? 0 : match.column - this._columnOffset,
            line: match.line,
            type: match.type,
            provider: this.Id
        };
    }
    private parseLines(outputLines: string[], regEx: string) {
        const diagnostics: ILintMessage[] = [];
        outputLines.filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems).forEach(line => {
            try {
                const msg = this.parseLine(line, regEx);
                if (msg) {
                    diagnostics.push(msg);
                }
            } catch (ex) {
                // Hmm, need to handle this later
                // TODO:
            }
        });
        return diagnostics;
    }
    private displayLinterResultHeader(data: string) {
        this.outputChannel.append(`${'#'.repeat(10)}Linting Output - ${this.Id}${'#'.repeat(10)}\n`);
        this.outputChannel.append(data);
    }
}
