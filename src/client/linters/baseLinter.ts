import * as path from 'path';
import * as vscode from 'vscode';
import { CancellationToken, OutputChannel, TextDocument, Uri } from 'vscode';
import '../common/extensions';
import { IPythonToolExecutionService } from '../common/process/types';
import { ExecutionInfo, ILogger, Product } from '../common/types';
import { IConfigurationService, IPythonSettings } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { ErrorHandler } from './errorHandlers/errorHandler';
import { ILinter, ILinterInfo, ILinterManager, ILintMessage, LintMessageSeverity } from './types';

// tslint:disable-next-line:no-require-imports no-var-requires
const namedRegexp = require('named-js-regexp');

const REGEX = '(?<line>\\d+),(?<column>\\d+),(?<type>\\w+),(?<code>\\w\\d+):(?<message>.*)\\r?(\\n|$)';

export interface IRegexGroup {
    line: number;
    column: number;
    code: string;
    message: string;
    type: string;
}

export function matchNamedRegEx(data, regex): IRegexGroup | undefined {
    const compiledRegexp = namedRegexp(regex, 'g');
    const rawMatch = compiledRegexp.exec(data);
    if (rawMatch !== null) {
        return <IRegexGroup>rawMatch.groups();
    }

    return undefined;
}

export abstract class BaseLinter implements ILinter {
    protected readonly configService: IConfigurationService;

    private errorHandler: ErrorHandler;
    private _pythonSettings: IPythonSettings;
    private _info: ILinterInfo;

    protected get pythonSettings(): IPythonSettings {
        return this._pythonSettings;
    }

    constructor(product: Product,
        protected readonly outputChannel: OutputChannel,
        protected readonly serviceContainer: IServiceContainer,
        protected readonly columnOffset = 0) {
        this._info = serviceContainer.get<ILinterManager>(ILinterManager).getLinterInfo(product);
        this.errorHandler = new ErrorHandler(this.info.product, outputChannel, serviceContainer);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    }

    public get info(): ILinterInfo {
        return this._info;
    }

    public isLinterExecutableSpecified(resource: Uri) {
        const executablePath = this.info.pathName(resource);
        return path.basename(executablePath).length > 0 && path.basename(executablePath) !== executablePath;
    }
    public async lint(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]> {
        this._pythonSettings = this.configService.getSettings(document.uri);
        return this.runLinter(document, cancellation);
    }

    protected getWorkspaceRootPath(document: vscode.TextDocument): string {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspaceRootPath = (workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string') ? workspaceFolder.uri.fsPath : undefined;
        return typeof workspaceRootPath === 'string' ? workspaceRootPath : __dirname;
    }
    protected get logger(): ILogger {
        return this.serviceContainer.get<ILogger>(ILogger);
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
        if (!this.info.isEnabled(document.uri)) {
            return [];
        }
        const executionInfo = this.info.getExecutionInfo(args, document.uri);
        const cwd = this.getWorkspaceRootPath(document);
        const pythonToolsExecutionService = this.serviceContainer.get<IPythonToolExecutionService>(IPythonToolExecutionService);
        try {
            const result = await pythonToolsExecutionService.exec(executionInfo, {cwd, token: cancellation, mergeStdOutErr: true}, document.uri);
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
        const match = matchNamedRegEx(line, regEx)!;
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
            provider: this.info.id
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
                    this.logger.logError(`Linter '${this.info.id}' failed to parse the line '${line}.`, ex);
                }
                return;
            })
            .filter(item => item !== undefined)
            .map(item => item!);
    }

    private displayLinterResultHeader(data: string) {
        this.outputChannel.append(`${'#'.repeat(10)}Linting Output - ${this.info.id}${'#'.repeat(10)}\n`);
        this.outputChannel.append(data);
    }
}
