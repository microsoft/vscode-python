'use strict';
import { IPythonSettings, PythonSettings } from '../common/configSettings';
import { execPythonFile } from './../common/utils';
import { OutputChannel, Uri } from 'vscode';
import { Installer, Product } from '../common/installer';
import * as vscode from 'vscode';
import { ErrorHandler } from './errorHandlers/main';

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
        NamedRegexp = require('named-js-regexp');
    }

    let compiledRegexp = NamedRegexp(regex, 'g');
    let rawMatch = compiledRegexp.exec(data);
    if (rawMatch !== null) {
        return <IRegexGroup>rawMatch.groups();
    }

    return null;
}

export abstract class BaseLinter {
    public Id: string;
    protected _columnOffset = 0;
    private _errorHandler: ErrorHandler;
    private _pythonSettings: IPythonSettings;
    protected get pythonSettings(): IPythonSettings {
        return this._pythonSettings;
    }
    protected getWorkspaceRootPath(document: vscode.TextDocument): string {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspaceRootPath = (workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string') ? workspaceFolder.uri.fsPath : undefined;
        return typeof workspaceRootPath === 'string' ? workspaceRootPath : __dirname;
    }
    constructor(id: string, public product: Product, protected outputChannel: OutputChannel) {
        this.Id = id;
        this._errorHandler = new ErrorHandler(this.Id, product, new Installer(), this.outputChannel);
    }
    public lint(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]> {
        this._pythonSettings = PythonSettings.getInstance(document.uri);
        return this.runLinter(document, cancellation);
    }
    protected abstract runLinter(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]>;
    protected parseMessagesSeverity(error: string, categorySeverity: any): LintMessageSeverity {
        if (categorySeverity[error]) {
            let severityName = categorySeverity[error];
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
                        return <LintMessageSeverity><any>LintMessageSeverity[severityName];
                    }
                }
            }
        }

        return LintMessageSeverity.Information;
    }

    private parseLine(line: string, regEx: string) {
        let match = matchNamedRegEx(line, regEx);
        if (!match) {
            return;
        }

        match.line = Number(<any>match.line);
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
        let diagnostics: ILintMessage[] = [];
        outputLines.filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems).forEach(line => {
            try {
                let msg = this.parseLine(line, regEx);
                if (msg) {
                    diagnostics.push(msg);
                }
            }
            catch (ex) {
                // Hmm, need to handle this later
                // TODO:
            }
        });
        return diagnostics;
    }
    private displayLinterResultHeader(data: string) {
        this.outputChannel.append('#'.repeat(10) + 'Linting Output - ' + this.Id + '#'.repeat(10) + '\n');
        this.outputChannel.append(data);
    }
    protected run(command: string, args: string[], document: vscode.TextDocument, cwd: string, cancellation: vscode.CancellationToken, regEx: string = REGEX): Promise<ILintMessage[]> {
        return execPythonFile(document.uri, command, args, cwd, true, null, cancellation).then(data => {
            if (!data) {
                data = '';
            }
            this.displayLinterResultHeader(data);
            let outputLines = data.split(/\r?\n/g);
            return this.parseLines(outputLines, regEx);
        }).catch(error => {
            this.handleError(this.Id, command, error, document.uri);
            return [];
        });
    }

    protected handleError(expectedFileName: string, fileName: string, error: Error, resource: Uri) {
        this._errorHandler.handleError(expectedFileName, fileName, error, resource);
    }
}
