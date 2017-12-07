import * as path from 'path';
import * as vscode from 'vscode';
import { CancellationToken, OutputChannel, TextDocument, Uri } from 'vscode';
import { IPythonSettings, PythonSettings } from '../common/configSettings';
import '../common/extensions';
import { Product } from '../common/installer';
import { ExecutionResult, IProcessService, IPythonExecutionFactory } from '../common/process/types';
import { ExecutionInfo, IInstaller, ILogger } from '../common/types';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
import { IServiceContainer } from '../ioc/types';
import { execPythonFile } from './../common/utils';
import { ErrorHandler } from './errorHandlers/main';
import { ILinterHelper, LinterId } from './types';

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
export abstract class BaseLinter {
    public Id: LinterId;
    private errorHandler: ErrorHandler;
    private _pythonSettings: IPythonSettings;
    protected get pythonSettings(): IPythonSettings {
        return this._pythonSettings;
    }
    constructor(public product: Product, protected outputChannel: OutputChannel,
        protected readonly installer: IInstaller,
        protected helper: ILinterHelper, protected logger: ILogger, protected serviceContainer: IServiceContainer,
        protected readonly columnOffset = 0) {
        this.Id = this.helper.translateToId(product);
        this.errorHandler = new ErrorHandler(product, installer, helper, logger, outputChannel, serviceContainer);
    }
    public isEnabled(resource: Uri) {
        this._pythonSettings = PythonSettings.getInstance(resource);
        const names = this.helper.getSettingsPropertyNames(this.product);
        return this._pythonSettings.linting[names.enabledName] as boolean;
    }
    public linterArgs(resource: Uri) {
        this._pythonSettings = PythonSettings.getInstance(resource);
        const names = this.helper.getSettingsPropertyNames(this.product);
        return this._pythonSettings.linting[names.argsName] as string[];
    }
    public isLinterExecutableSpecified(resource: Uri) {
        this._pythonSettings = PythonSettings.getInstance(resource);
        const names = this.helper.getSettingsPropertyNames(this.product);
        const executablePath = this._pythonSettings.linting[names.pathName] as string;
        return path.basename(executablePath).length > 0 && path.basename(executablePath) !== executablePath;
    }
    public async lint(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]> {
        if (!this.isEnabled(document.uri)) {
            return [];
        }
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
    protected async run(args: string[], document: vscode.TextDocument, cancellation: vscode.CancellationToken, regEx: string = REGEX): Promise<ILintMessage[]> {
        const executionInfo = this.helper.getExecutionInfo(this.product, args, document.uri);
        const cwd = this.getWorkspaceRootPath(document);
        let executionPromise: Promise<ExecutionResult<string>>;

        // Check if required to run as a module or executable.
        if (executionInfo.moduleName) {
            const pythonExecutionService = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create(document.uri);
            executionPromise = pythonExecutionService.execModule(executionInfo.moduleName!, executionInfo.args, { cwd, mergeStdOutErr: true, token: cancellation });
        } else {
            const env = await this.serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider).getEnvironmentVariables(true, document.uri);
            const executionService = this.serviceContainer.get<IProcessService>(IProcessService);
            executionPromise = executionService.exec(executionInfo.execPath, args, { cwd, env, token: cancellation, mergeStdOutErr: true });
        }
        try {
            const result = await executionPromise;
            this.displayLinterResultHeader(result.stdout);
            return await this.parseMessages(result.stdout, document, cancellation, regEx);
        } catch (error) {
            this.handleError(error, document.uri, executionInfo);
            return [];
        }
    }
    protected async parseMessages(output: string, document: TextDocument, token: CancellationToken, regEx: string) {
        const outputLines = output.splitLines({ removeEmptyEntries: false, trim: false });
        return this.parseLines(outputLines, regEx);
    }
    protected handleError(error: Error, resource: Uri, execInfo: ExecutionInfo) {
        this.errorHandler.handleError(error, resource, execInfo)
            .catch(this.logger.logError.bind(this, 'Error in errorHandler.handleError'));
    }

    private parseLine(line: string, regEx: string): ILintMessage | undefined {
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
            column: isNaN(match.column) || match.column === 0 ? 0 : match.column - this.columnOffset,
            line: match.line,
            type: match.type,
            provider: this.Id
        };
    }
    private parseLines(outputLines: string[], regEx: string): ILintMessage[] {
        return outputLines
            .filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems)
            .map(line => {
                try {
                    const msg = this.parseLine(line, regEx);
                    if (msg) {
                        return msg;
                    }
                } catch (ex) {
                    this.logger.logError(`Linter '${this.Id}' failed to parse the line '${line}.`, ex);
                }
                return;
            })
            .filter(item => item !== undefined)
            .map(item => item!);
    }
    private displayLinterResultHeader(data: string) {
        this.outputChannel.append(`${'#'.repeat(10)}Linting Output - ${this.Id}${'#'.repeat(10)}\n`);
        this.outputChannel.append(data);
    }
}
