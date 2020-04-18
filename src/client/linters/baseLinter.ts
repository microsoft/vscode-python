// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { IWorkspaceService } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import '../common/extensions';
import { traceError } from '../common/logger';
import { IPythonToolExecutionService } from '../common/process/types';
import { ExecutionInfo, IConfigurationService, IPythonSettings, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { ErrorHandler } from './errorHandlers/errorHandler';
import { ILinter, ILinterInfo, ILinterManager, ILintMessage, LinterId, LintMessageSeverity } from './types';

// tslint:disable-next-line:no-require-imports no-var-requires no-any
const namedRegexp = require('named-js-regexp');
// Allow negative column numbers (https://github.com/PyCQA/pylint/issues/1822)
// Allow codes with more than one letter (i.e. ABC123)
const REGEX = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>\\w+\\d+):(?<message>.*)\\r?(\\n|$)';

export interface IRegexGroup {
    line: number;
    column: number;
    code: string;
    message: string;
    type: string;
}

export function matchNamedRegEx(data: string, regex: string): IRegexGroup | undefined {
    const compiledRegexp = namedRegexp(regex, 'g');
    const rawMatch = compiledRegexp.exec(data);
    if (rawMatch !== null) {
        return <IRegexGroup>rawMatch.groups();
    }

    return undefined;
}

export function parseLine(
    line: string,
    regex: string,
    linterID: LinterId,
    colOffset: number = 0
): ILintMessage | undefined {
    const match = matchNamedRegEx(line, regex)!;
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
        column: isNaN(match.column) || match.column <= 0 ? 0 : match.column - colOffset,
        line: match.line,
        type: match.type,
        provider: linterID
    };
}

export abstract class BaseLinter implements ILinter {
    protected readonly configService: IConfigurationService;

    private errorHandler: ErrorHandler;
    private _pythonSettings!: IPythonSettings;
    private _info: ILinterInfo;
    private workspace: IWorkspaceService;

    protected get pythonSettings(): IPythonSettings {
        return this._pythonSettings;
    }

    constructor(
        product: Product,
        protected readonly outputChannel: vscode.OutputChannel,
        protected readonly serviceContainer: IServiceContainer,
        protected readonly columnOffset = 0
    ) {
        this._info = serviceContainer.get<ILinterManager>(ILinterManager).getLinterInfo(product);
        this.errorHandler = new ErrorHandler(this.info.product, outputChannel, serviceContainer);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.workspace = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public get info(): ILinterInfo {
        return this._info;
    }

    public async lint(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]> {
        this._pythonSettings = this.configService.getSettings(document.uri);
        return this.runLinter(document, cancellation);
    }

    protected getWorkspaceRootPath(document: vscode.TextDocument): string {
        const workspaceFolder = this.workspace.getWorkspaceFolder(document.uri);
        const workspaceRootPath =
            workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string' ? workspaceFolder.uri.fsPath : undefined;
        return typeof workspaceRootPath === 'string' ? workspaceRootPath : path.dirname(document.uri.fsPath);
    }
    protected abstract runLinter(
        document: vscode.TextDocument,
        cancellation: vscode.CancellationToken
    ): Promise<ILintMessage[]>;

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
                        return <LintMessageSeverity>(<any>LintMessageSeverity[severityName]);
                    }
                }
            }
        }
        return LintMessageSeverity.Information;
    }

    protected async run(
        args: string[],
        document: vscode.TextDocument,
        cancellation: vscode.CancellationToken,
        regEx: string = REGEX
    ): Promise<ILintMessage[]> {
        if (!this.info.isEnabled(document.uri)) {
            return [];
        }
        const executionInfo = this.info.getExecutionInfo(args, document.uri);
        const cwd = this.getWorkspaceRootPath(document);
        const pythonToolsExecutionService = this.serviceContainer.get<IPythonToolExecutionService>(
            IPythonToolExecutionService
        );
        try {
            const result = await pythonToolsExecutionService.exec(
                executionInfo,
                { cwd, token: cancellation, mergeStdOutErr: false },
                document.uri
            );
            this.displayLinterResultHeader(result.stdout);
            return await this.parseMessages(result.stdout, document, cancellation, regEx);
        } catch (error) {
            await this.handleError(error, document.uri, executionInfo);
            return [];
        }
    }

    protected async parseMessages(
        output: string,
        _document: vscode.TextDocument,
        _token: vscode.CancellationToken,
        regEx: string
    ) {
        const outputLines = output.splitLines({ removeEmptyEntries: false, trim: false });
        return this.parseLines(outputLines, regEx);
    }

    protected async handleError(error: Error, resource: vscode.Uri, execInfo: ExecutionInfo) {
        if (isTestExecution()) {
            this.errorHandler.handleError(error, resource, execInfo).ignoreErrors();
        } else {
            this.errorHandler
                .handleError(error, resource, execInfo)
                .catch((ex) => traceError('Error in errorHandler.handleError', ex))
                .ignoreErrors();
        }
    }

    private parseLine(line: string, regEx: string): ILintMessage | undefined {
        return parseLine(line, regEx, this.info.id, this.columnOffset);
    }

    private parseLines(outputLines: string[], regEx: string): ILintMessage[] {
        const messages: ILintMessage[] = [];
        for (const line of outputLines) {
            try {
                const msg = this.parseLine(line, regEx);
                if (msg) {
                    messages.push(msg);
                    if (messages.length >= this.pythonSettings.linting.maxNumberOfProblems) {
                        break;
                    }
                }
            } catch (ex) {
                traceError(`Linter '${this.info.id}' failed to parse the line '${line}.`, ex);
            }
        }
        return messages;
    }

    private displayLinterResultHeader(data: string) {
        this.outputChannel.append(`${'#'.repeat(10)}Linting Output - ${this.info.id}${'#'.repeat(10)}\n`);
        this.outputChannel.append(data);
    }
}
