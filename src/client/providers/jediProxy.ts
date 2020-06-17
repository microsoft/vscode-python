// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-var-requires no-require-imports no-any
import { ChildProcess } from 'child_process';
import * as path from 'path';
// @ts-ignore
import * as pidusage from 'pidusage';
import { CancellationToken, CancellationTokenSource, CompletionItemKind, Disposable, SymbolKind, Uri } from 'vscode';
import { isTestExecution } from '../common/constants';
import '../common/extensions';
import { IS_WINDOWS } from '../common/platform/constants';
import { IFileSystem } from '../common/platform/types';
import * as internalPython from '../common/process/internal/python';
import * as internalScripts from '../common/process/internal/scripts';
import { IPythonExecutionFactory } from '../common/process/types';
import {
    BANNER_NAME_PROPOSE_LS,
    IConfigurationService,
    IPythonExtensionBanner,
    IPythonSettings
} from '../common/types';
import { createDeferred, Deferred } from '../common/utils/async';
import { swallowExceptions } from '../common/utils/decorators';
import { StopWatch } from '../common/utils/stopWatch';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
import { IServiceContainer } from '../ioc/types';
import { PythonInterpreter } from '../pythonEnvironments/info';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { traceError, traceWarning } from './../common/logger';

const pythonVSCodeTypeMappings = new Map<string, CompletionItemKind>();
pythonVSCodeTypeMappings.set('none', CompletionItemKind.Value);
pythonVSCodeTypeMappings.set('type', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('tuple', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dict', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dictionary', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('function', CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('lambda', CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('generator', CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('class', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('instance', CompletionItemKind.Reference);
pythonVSCodeTypeMappings.set('method', CompletionItemKind.Method);
pythonVSCodeTypeMappings.set('builtin', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('builtinfunction', CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('module', CompletionItemKind.Module);
pythonVSCodeTypeMappings.set('file', CompletionItemKind.File);
pythonVSCodeTypeMappings.set('xrange', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('slice', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('traceback', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('frame', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('buffer', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dictproxy', CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('funcdef', CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('property', CompletionItemKind.Property);
pythonVSCodeTypeMappings.set('import', CompletionItemKind.Module);
pythonVSCodeTypeMappings.set('keyword', CompletionItemKind.Keyword);
pythonVSCodeTypeMappings.set('constant', CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('variable', CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('value', CompletionItemKind.Value);
pythonVSCodeTypeMappings.set('param', CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('statement', CompletionItemKind.Keyword);

const pythonVSCodeSymbolMappings = new Map<string, SymbolKind>();
pythonVSCodeSymbolMappings.set('none', SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('type', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('tuple', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('dict', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('dictionary', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('function', SymbolKind.Function);
pythonVSCodeSymbolMappings.set('lambda', SymbolKind.Function);
pythonVSCodeSymbolMappings.set('generator', SymbolKind.Function);
pythonVSCodeSymbolMappings.set('class', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('instance', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('method', SymbolKind.Method);
pythonVSCodeSymbolMappings.set('builtin', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('builtinfunction', SymbolKind.Function);
pythonVSCodeSymbolMappings.set('module', SymbolKind.Module);
pythonVSCodeSymbolMappings.set('file', SymbolKind.File);
pythonVSCodeSymbolMappings.set('xrange', SymbolKind.Array);
pythonVSCodeSymbolMappings.set('slice', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('traceback', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('frame', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('buffer', SymbolKind.Array);
pythonVSCodeSymbolMappings.set('dictproxy', SymbolKind.Class);
pythonVSCodeSymbolMappings.set('funcdef', SymbolKind.Function);
pythonVSCodeSymbolMappings.set('property', SymbolKind.Property);
pythonVSCodeSymbolMappings.set('import', SymbolKind.Module);
pythonVSCodeSymbolMappings.set('keyword', SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('constant', SymbolKind.Constant);
pythonVSCodeSymbolMappings.set('variable', SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('value', SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('param', SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('statement', SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('boolean', SymbolKind.Boolean);
pythonVSCodeSymbolMappings.set('int', SymbolKind.Number);
pythonVSCodeSymbolMappings.set('longlean', SymbolKind.Number);
pythonVSCodeSymbolMappings.set('float', SymbolKind.Number);
pythonVSCodeSymbolMappings.set('complex', SymbolKind.Number);
pythonVSCodeSymbolMappings.set('string', SymbolKind.String);
pythonVSCodeSymbolMappings.set('unicode', SymbolKind.String);
pythonVSCodeSymbolMappings.set('list', SymbolKind.Array);

function getMappedVSCodeType(pythonType: string): CompletionItemKind {
    if (pythonVSCodeTypeMappings.has(pythonType)) {
        const value = pythonVSCodeTypeMappings.get(pythonType);
        if (value) {
            return value;
        }
    }
    return CompletionItemKind.Keyword;
}

function getMappedVSCodeSymbol(pythonType: string): SymbolKind {
    if (pythonVSCodeSymbolMappings.has(pythonType)) {
        const value = pythonVSCodeSymbolMappings.get(pythonType);
        if (value) {
            return value;
        }
    }
    return SymbolKind.Variable;
}

export enum CommandType {
    Arguments,
    Completions,
    Hover,
    Usages,
    Definitions,
    Symbols
}

const commandNames = new Map<CommandType, string>();
commandNames.set(CommandType.Arguments, 'arguments');
commandNames.set(CommandType.Completions, 'completions');
commandNames.set(CommandType.Definitions, 'definitions');
commandNames.set(CommandType.Hover, 'tooltip');
commandNames.set(CommandType.Usages, 'usages');
commandNames.set(CommandType.Symbols, 'names');

export class JediProxy implements Disposable {
    private proc?: ChildProcess;
    private pythonSettings: IPythonSettings;
    private cmdId: number = 0;
    private lastKnownPythonInterpreter: string;
    private previousData = '';
    private commands = new Map<number, IExecutionCommand<ICommandResult>>();
    private commandQueue: number[] = [];
    private spawnRetryAttempts = 0;
    private additionalAutoCompletePaths: string[] = [];
    private workspacePath: string;
    private languageServerStarted!: Deferred<void>;
    private initialized: Deferred<void>;
    private environmentVariablesProvider!: IEnvironmentVariablesProvider;
    private ignoreJediMemoryFootprint: boolean = false;
    private pidUsageFailures = { timer: new StopWatch(), counter: 0 };
    private lastCmdIdProcessed?: number;
    private lastCmdIdProcessedForPidUsage?: number;
    private proposeNewLanguageServerPopup: IPythonExtensionBanner;
    private readonly disposables: Disposable[] = [];
    private timer?: NodeJS.Timer | number;

    public constructor(
        workspacePath: string,
        interpreter: PythonInterpreter | undefined,
        private serviceContainer: IServiceContainer
    ) {
        this.workspacePath = workspacePath;
        const configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.pythonSettings = configurationService.getSettings(Uri.file(workspacePath));
        this.lastKnownPythonInterpreter = interpreter ? interpreter.path : this.pythonSettings.pythonPath;
        this.initialized = createDeferred<void>();
        this.startLanguageServer()
            .then(() => this.initialized.resolve())
            .ignoreErrors();

        this.proposeNewLanguageServerPopup = serviceContainer.get<IPythonExtensionBanner>(
            IPythonExtensionBanner,
            BANNER_NAME_PROPOSE_LS
        );

        this.checkJediMemoryFootprint().ignoreErrors();
    }

    private static getProperty<T>(o: object, name: string): T {
        return <T>(o as any)[name];
    }

    public dispose() {
        while (this.disposables.length > 0) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
        if (this.timer) {
            clearTimeout(this.timer as any);
        }
        this.killProcess();
    }

    public getNextCommandId(): number {
        const result = this.cmdId;
        this.cmdId += 1;
        return result;
    }

    public async sendCommand<T extends ICommandResult>(cmd: ICommand): Promise<T> {
        await this.initialized.promise;
        await this.languageServerStarted.promise;
        if (!this.proc) {
            return Promise.reject(new Error('Python proc not initialized'));
        }

        const executionCmd = <IExecutionCommand<T>>cmd;
        const payload = this.createPayload(executionCmd);
        executionCmd.deferred = createDeferred<T>();
        try {
            this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
            this.commands.set(executionCmd.id, executionCmd);
            this.commandQueue.push(executionCmd.id);
        } catch (ex) {
            traceError(ex);
            //If 'This socket is closed.' that means process didn't start at all (at least not properly).
            if (ex.message === 'This socket is closed.') {
                this.killProcess();
            } else {
                this.handleError('sendCommand', ex.message);
            }
            return Promise.reject(ex);
        }
        return executionCmd.deferred.promise;
    }

    // keep track of the directory so we can re-spawn the process.
    private initialize(): Promise<void> {
        return this.spawnProcess().catch((ex) => {
            if (this.languageServerStarted) {
                this.languageServerStarted.reject(ex);
            }
            this.handleError('spawnProcess', ex);
        });
    }
    private shouldCheckJediMemoryFootprint() {
        if (this.ignoreJediMemoryFootprint || this.pythonSettings.jediMemoryLimit === -1) {
            return false;
        }
        if (
            this.lastCmdIdProcessedForPidUsage &&
            this.lastCmdIdProcessed &&
            this.lastCmdIdProcessedForPidUsage === this.lastCmdIdProcessed
        ) {
            // If no more commands were processed since the last time,
            //  then there's no need to check again.
            return false;
        }
        return true;
    }
    private async checkJediMemoryFootprint() {
        // Check memory footprint periodically. Do not check on every request due to
        // the performance impact. See https://github.com/soyuka/pidusage - on Windows
        // it is using wmic which means spawning cmd.exe process on every request.
        if (this.pythonSettings.jediMemoryLimit === -1) {
            return;
        }

        await this.checkJediMemoryFootprintImpl();
        if (this.timer) {
            clearTimeout(this.timer as any);
        }
        this.timer = setTimeout(() => this.checkJediMemoryFootprint(), 15 * 1000);
    }
    private async checkJediMemoryFootprintImpl(): Promise<void> {
        if (!this.proc || this.proc.killed) {
            return;
        }
        if (!this.shouldCheckJediMemoryFootprint()) {
            return;
        }
        this.lastCmdIdProcessedForPidUsage = this.lastCmdIdProcessed;

        // Do not run pidusage over and over, wait for it to finish.
        const deferred = createDeferred<void>();
        (pidusage as any).stat(this.proc.pid, async (err: any, result: any) => {
            if (err) {
                this.pidUsageFailures.counter += 1;
                // If this function fails 2 times in the last 60 seconds, lets not try ever again.
                if (this.pidUsageFailures.timer.elapsedTime > 60 * 1000) {
                    this.ignoreJediMemoryFootprint = this.pidUsageFailures.counter > 2;
                    this.pidUsageFailures.counter = 0;
                    this.pidUsageFailures.timer.reset();
                }
                traceError('Python Extension: (pidusage)', err);
            } else {
                const limit = Math.min(Math.max(this.pythonSettings.jediMemoryLimit, 1024), 8192);
                let restartJedi = false;
                if (result && result.memory) {
                    restartJedi = result.memory > limit * 1024 * 1024;
                    const props = {
                        mem_use: result.memory,
                        limit: limit * 1024 * 1024,
                        isUserDefinedLimit: limit !== 1024,
                        restart: restartJedi
                    };
                    sendTelemetryEvent(EventName.JEDI_MEMORY, undefined, props);
                }
                if (restartJedi) {
                    traceWarning(
                        `IntelliSense process memory consumption exceeded limit of ${limit} MB and process will be restarted.\nThe limit is controlled by the 'python.jediMemoryLimit' setting.`
                    );
                    await this.restartLanguageServer();
                }
            }

            deferred.resolve();
        });

        return deferred.promise;
    }

    // @debounce(1500)
    @swallowExceptions('JediProxy')
    private async environmentVariablesChangeHandler() {
        const newAutoComletePaths = await this.buildAutoCompletePaths();
        if (this.additionalAutoCompletePaths.join(',') !== newAutoComletePaths.join(',')) {
            this.additionalAutoCompletePaths = newAutoComletePaths;
            this.restartLanguageServer().ignoreErrors();
        }
    }
    @swallowExceptions('JediProxy')
    private async startLanguageServer(): Promise<void> {
        const newAutoComletePaths = await this.buildAutoCompletePaths();
        this.additionalAutoCompletePaths = newAutoComletePaths;
        if (!isTestExecution()) {
            await this.proposeNewLanguageServerPopup.showBanner();
        }
        return this.restartLanguageServer();
    }
    private restartLanguageServer(): Promise<void> {
        this.killProcess();
        this.clearPendingRequests();
        return this.initialize();
    }

    private clearPendingRequests() {
        this.commandQueue = [];
        this.commands.forEach((item) => {
            if (item.deferred !== undefined) {
                item.deferred.resolve();
            }
        });
        this.commands.clear();
    }

    private killProcess() {
        try {
            if (this.proc) {
                this.proc.kill();
            }
            // tslint:disable-next-line:no-empty
        } catch (ex) {}
        this.proc = undefined;
    }

    private handleError(source: string, errorMessage: string) {
        traceError(`${source} jediProxy`, `Error (${source}) ${errorMessage}`);
    }

    // tslint:disable-next-line:max-func-body-length
    private async spawnProcess() {
        if (this.languageServerStarted && !this.languageServerStarted.completed) {
            this.languageServerStarted.reject(new Error('Language Server not started.'));
        }
        this.languageServerStarted = createDeferred<void>();
        const pythonProcess = await this.serviceContainer
            .get<IPythonExecutionFactory>(IPythonExecutionFactory)
            .create({ resource: Uri.file(this.workspacePath), pythonPath: this.lastKnownPythonInterpreter });
        // Check if the python path is valid.
        if ((await pythonProcess.getExecutablePath().catch(() => '')).length === 0) {
            return;
        }
        const [args, parse] = internalScripts.completion(this.pythonSettings.jediPath);
        const result = pythonProcess.execObservable(args, {});
        this.proc = result.proc;
        this.languageServerStarted.resolve();
        this.proc!.on('end', (end) => {
            traceError('spawnProcess.end', `End - ${end}`);
        });
        this.proc!.on('error', (error) => {
            this.handleError('error', `${error}`);
            this.spawnRetryAttempts += 1;
            if (
                this.spawnRetryAttempts < 10 &&
                error &&
                error.message &&
                error.message.indexOf('This socket has been ended by the other party') >= 0
            ) {
                this.spawnProcess().catch((ex) => {
                    if (this.languageServerStarted) {
                        this.languageServerStarted.reject(ex);
                    }
                    this.handleError('spawnProcess', ex);
                });
            }
        });
        result.out.subscribe(
            (output) => {
                if (output.source === 'stderr') {
                    this.handleError('stderr', output.out);
                } else {
                    const data = output.out;
                    // Possible there was an exception in parsing the data returned,
                    // so append the data and then parse it.
                    const dataStr = (this.previousData = `${this.previousData}${data}`);
                    // tslint:disable-next-line:no-any
                    let responses: any[];
                    try {
                        responses = parse(dataStr);
                        this.previousData = '';
                    } catch (ex) {
                        // Possible we've only received part of the data, hence don't clear previousData.
                        // Don't log errors when we haven't received the entire response.
                        if (
                            ex.message.indexOf('Unexpected end of input') === -1 &&
                            ex.message.indexOf('Unexpected end of JSON input') === -1 &&
                            ex.message.indexOf('Unexpected token') === -1
                        ) {
                            this.handleError('stdout', ex.message);
                        }
                        return;
                    }

                    responses.forEach((response) => {
                        if (!response) {
                            return;
                        }
                        const responseId = JediProxy.getProperty<number>(response, 'id');
                        if (!this.commands.has(responseId)) {
                            return;
                        }
                        const cmd = this.commands.get(responseId);
                        if (!cmd) {
                            return;
                        }
                        this.lastCmdIdProcessed = cmd.id;
                        if (JediProxy.getProperty<object>(response, 'arguments')) {
                            this.commandQueue.splice(this.commandQueue.indexOf(cmd.id), 1);
                            return;
                        }

                        this.commands.delete(responseId);
                        const index = this.commandQueue.indexOf(cmd.id);
                        if (index) {
                            this.commandQueue.splice(index, 1);
                        }

                        // Check if this command has expired.
                        if (cmd.token.isCancellationRequested) {
                            this.safeResolve(cmd, undefined);
                            return;
                        }

                        const handler = this.getCommandHandler(cmd.command);
                        if (handler) {
                            handler.call(this, cmd, response);
                        }
                        // Check if too many pending requests.
                        this.checkQueueLength();
                    });
                }
            },
            (error) => this.handleError('subscription.error', `${error}`)
        );
    }
    private getCommandHandler(
        command: CommandType
    ): undefined | ((command: IExecutionCommand<ICommandResult>, response: object) => void) {
        switch (command) {
            case CommandType.Completions:
                return this.onCompletion;
            case CommandType.Definitions:
                return this.onDefinition;
            case CommandType.Hover:
                return this.onHover;
            case CommandType.Symbols:
                return this.onSymbols;
            case CommandType.Usages:
                return this.onUsages;
            case CommandType.Arguments:
                return this.onArguments;
            default:
                return;
        }
    }
    private onCompletion(command: IExecutionCommand<ICommandResult>, response: object): void {
        let results = JediProxy.getProperty<IAutoCompleteItem[]>(response, 'results');
        results = Array.isArray(results) ? results : [];
        results.forEach((item) => {
            // tslint:disable-next-line:no-any
            const originalType = <string>(<any>item.type);
            item.type = getMappedVSCodeType(originalType);
            item.kind = getMappedVSCodeSymbol(originalType);
            item.rawType = getMappedVSCodeType(originalType);
        });
        const completionResult: ICompletionResult = {
            items: results,
            requestId: command.id
        };
        this.safeResolve(command, completionResult);
    }

    private onDefinition(command: IExecutionCommand<ICommandResult>, response: object): void {
        // tslint:disable-next-line:no-any
        const defs = JediProxy.getProperty<any[]>(response, 'results');
        const defResult: IDefinitionResult = {
            requestId: command.id,
            definitions: []
        };
        if (defs.length > 0) {
            defResult.definitions = defs.map((def) => {
                const originalType = def.type as string;
                return {
                    fileName: def.fileName,
                    text: def.text,
                    rawType: originalType,
                    type: getMappedVSCodeType(originalType),
                    kind: getMappedVSCodeSymbol(originalType),
                    container: def.container,
                    range: {
                        startLine: def.range.start_line,
                        startColumn: def.range.start_column,
                        endLine: def.range.end_line,
                        endColumn: def.range.end_column
                    }
                };
            });
        }
        this.safeResolve(command, defResult);
    }

    private onHover(command: IExecutionCommand<ICommandResult>, response: object): void {
        // tslint:disable-next-line:no-any
        const defs = JediProxy.getProperty<any[]>(response, 'results');
        const defResult: IHoverResult = {
            requestId: command.id,
            items: defs.map((def) => {
                return {
                    kind: getMappedVSCodeSymbol(def.type),
                    description: def.description,
                    signature: def.signature,
                    docstring: def.docstring,
                    text: def.text
                };
            })
        };
        this.safeResolve(command, defResult);
    }

    private onSymbols(command: IExecutionCommand<ICommandResult>, response: object): void {
        // tslint:disable-next-line:no-any
        let defs = JediProxy.getProperty<any[]>(response, 'results');
        defs = Array.isArray(defs) ? defs : [];
        const defResults: ISymbolResult = {
            requestId: command.id,
            definitions: []
        };
        defResults.definitions = defs.map<IDefinition>((def) => {
            const originalType = def.type as string;
            return {
                fileName: def.fileName,
                text: def.text,
                rawType: originalType,
                type: getMappedVSCodeType(originalType),
                kind: getMappedVSCodeSymbol(originalType),
                container: def.container,
                range: {
                    startLine: def.range.start_line,
                    startColumn: def.range.start_column,
                    endLine: def.range.end_line,
                    endColumn: def.range.end_column
                }
            };
        });
        this.safeResolve(command, defResults);
    }

    private onUsages(command: IExecutionCommand<ICommandResult>, response: object): void {
        // tslint:disable-next-line:no-any
        let defs = JediProxy.getProperty<any[]>(response, 'results');
        defs = Array.isArray(defs) ? defs : [];
        const refResult: IReferenceResult = {
            requestId: command.id,
            references: defs.map((item) => {
                return {
                    columnIndex: item.column,
                    fileName: item.fileName,
                    lineIndex: item.line - 1,
                    moduleName: item.moduleName,
                    name: item.name
                };
            })
        };
        this.safeResolve(command, refResult);
    }

    private onArguments(command: IExecutionCommand<ICommandResult>, response: object): void {
        // tslint:disable-next-line:no-any
        const defs = JediProxy.getProperty<any[]>(response, 'results');
        // tslint:disable-next-line:no-object-literal-type-assertion
        this.safeResolve(command, <IArgumentsResult>{
            requestId: command.id,
            definitions: defs
        });
    }

    private checkQueueLength(): void {
        if (this.commandQueue.length > 10) {
            const items = this.commandQueue.splice(0, this.commandQueue.length - 10);
            items.forEach((id) => {
                if (this.commands.has(id)) {
                    const cmd1 = this.commands.get(id);
                    try {
                        this.safeResolve(cmd1, undefined);
                        // tslint:disable-next-line:no-empty
                    } catch (ex) {
                    } finally {
                        this.commands.delete(id);
                    }
                }
            });
        }
    }

    // tslint:disable-next-line:no-any
    private createPayload<T extends ICommandResult>(cmd: IExecutionCommand<T>): any {
        const payload = {
            id: cmd.id,
            prefix: '',
            lookup: commandNames.get(cmd.command),
            path: cmd.fileName,
            source: cmd.source,
            line: cmd.lineIndex,
            column: cmd.columnIndex,
            config: this.getConfig()
        };

        if (cmd.command === CommandType.Symbols) {
            delete payload.column;
            delete payload.line;
        }

        return payload;
    }

    private async getPathFromPython(getArgs = internalPython.getExecutable): Promise<string> {
        const [args, parse] = getArgs();
        try {
            const pythonProcess = await this.serviceContainer
                .get<IPythonExecutionFactory>(IPythonExecutionFactory)
                .create({ resource: Uri.file(this.workspacePath), pythonPath: this.lastKnownPythonInterpreter });
            const result = await pythonProcess.exec(args, { cwd: this.workspacePath });
            const lines = parse(result.stdout).splitLines();
            if (lines.length === 0) {
                return '';
            }
            const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
            const exists = await fs.fileExists(lines[0]);
            return exists ? lines[0] : '';
        } catch {
            return '';
        }
    }
    private async buildAutoCompletePaths(): Promise<string[]> {
        const filePathPromises = [
            // Sysprefix.
            this.getPathFromPython(internalPython.getSysPrefix).catch(() => ''),
            // exeucutable path.
            this.getPathFromPython(internalPython.getExecutable)
                .then((execPath) => path.dirname(execPath))
                .catch(() => ''),
            // Python specific site packages.
            this.getPathFromPython(internalPython.getSitePackages)
                .then((libPath) => {
                    // On windows we also need the libs path (second item will return c:\xxx\lib\site-packages).
                    // This is returned by "from distutils.sysconfig import get_python_lib; print(get_python_lib())".
                    return IS_WINDOWS && libPath.length > 0 ? path.join(libPath, '..') : libPath;
                })
                .catch(() => ''),
            // Python global site packages, as a fallback in case user hasn't installed them in custom environment.
            this.getPathFromPython(internalPython.getUserSitePackages).catch(() => '')
        ];

        try {
            const pythonPaths = await this.getEnvironmentVariablesProvider()
                .getEnvironmentVariables(Uri.file(this.workspacePath))
                .then((customEnvironmentVars) =>
                    customEnvironmentVars ? JediProxy.getProperty<string>(customEnvironmentVars, 'PYTHONPATH') : ''
                )
                .then((pythonPath) =>
                    typeof pythonPath === 'string' && pythonPath.trim().length > 0 ? pythonPath.trim() : ''
                )
                .then((pythonPath) => pythonPath.split(path.delimiter).filter((item) => item.trim().length > 0));
            const resolvedPaths = pythonPaths
                .filter((pythonPath) => !path.isAbsolute(pythonPath))
                .map((pythonPath) => path.resolve(this.workspacePath, pythonPath));
            const filePaths = await Promise.all(filePathPromises);
            return filePaths.concat(...pythonPaths, ...resolvedPaths).filter((p) => p.length > 0);
        } catch (ex) {
            traceError('Python Extension: jediProxy.filePaths', ex);
            return [];
        }
    }
    private getEnvironmentVariablesProvider() {
        if (!this.environmentVariablesProvider) {
            this.environmentVariablesProvider = this.serviceContainer.get<IEnvironmentVariablesProvider>(
                IEnvironmentVariablesProvider
            );
            this.environmentVariablesProvider.onDidEnvironmentVariablesChange(
                this.environmentVariablesChangeHandler.bind(this)
            );
        }
        return this.environmentVariablesProvider;
    }
    private getConfig() {
        // Add support for paths relative to workspace.
        const extraPaths = this.pythonSettings.autoComplete
            ? this.pythonSettings.autoComplete.extraPaths.map((extraPath) => {
                  if (path.isAbsolute(extraPath)) {
                      return extraPath;
                  }
                  if (typeof this.workspacePath !== 'string') {
                      return '';
                  }
                  return path.join(this.workspacePath, extraPath);
              })
            : [];

        // Always add workspace path into extra paths.
        if (typeof this.workspacePath === 'string') {
            extraPaths.unshift(this.workspacePath);
        }

        const distinctExtraPaths = extraPaths
            .concat(this.additionalAutoCompletePaths)
            .filter((value) => value.length > 0)
            .filter((value, index, self) => self.indexOf(value) === index);

        return {
            extraPaths: distinctExtraPaths,
            useSnippets: false,
            caseInsensitiveCompletion: true,
            showDescriptions: true,
            fuzzyMatcher: true
        };
    }

    private safeResolve(
        command: IExecutionCommand<ICommandResult> | undefined | null,
        result: ICommandResult | PromiseLike<ICommandResult> | undefined
    ): void {
        if (command && command.deferred) {
            command.deferred.resolve(result);
        }
    }
}

// tslint:disable-next-line:no-unused-variable
export interface ICommand {
    telemetryEvent?: string;
    command: CommandType;
    source?: string;
    fileName: string;
    lineIndex: number;
    columnIndex: number;
}

interface IExecutionCommand<T extends ICommandResult> extends ICommand {
    id: number;
    deferred?: Deferred<T>;
    token: CancellationToken;
    delay?: number;
}

export interface ICommandError {
    message: string;
}

export interface ICommandResult {
    requestId: number;
}
export interface ICompletionResult extends ICommandResult {
    items: IAutoCompleteItem[];
}
export interface IHoverResult extends ICommandResult {
    items: IHoverItem[];
}
export interface IDefinitionResult extends ICommandResult {
    definitions: IDefinition[];
}
export interface IReferenceResult extends ICommandResult {
    references: IReference[];
}
export interface ISymbolResult extends ICommandResult {
    definitions: IDefinition[];
}
export interface IArgumentsResult extends ICommandResult {
    definitions: ISignature[];
}

export interface ISignature {
    name: string;
    docstring: string;
    description: string;
    paramindex: number;
    params: IArgument[];
}
export interface IArgument {
    name: string;
    value: string;
    docstring: string;
    description: string;
}

export interface IReference {
    name: string;
    fileName: string;
    columnIndex: number;
    lineIndex: number;
    moduleName: string;
}

export interface IAutoCompleteItem {
    type: CompletionItemKind;
    rawType: CompletionItemKind;
    kind: SymbolKind;
    text: string;
    description: string;
    raw_docstring: string;
    rightLabel: string;
}
export interface IDefinitionRange {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}
export interface IDefinition {
    rawType: string;
    type: CompletionItemKind;
    kind: SymbolKind;
    text: string;
    fileName: string;
    container: string;
    range: IDefinitionRange;
}

export interface IHoverItem {
    kind: SymbolKind;
    text: string;
    description: string;
    docstring: string;
    signature: string;
}

export class JediProxyHandler<R extends ICommandResult> implements Disposable {
    private commandCancellationTokenSources: Map<CommandType, CancellationTokenSource>;

    public get JediProxy(): JediProxy {
        return this.jediProxy;
    }

    public constructor(private jediProxy: JediProxy) {
        this.commandCancellationTokenSources = new Map<CommandType, CancellationTokenSource>();
    }

    public dispose() {
        if (this.jediProxy) {
            this.jediProxy.dispose();
        }
    }

    public sendCommand(cmd: ICommand, _token?: CancellationToken): Promise<R | undefined> {
        const executionCmd = <IExecutionCommand<R>>cmd;
        executionCmd.id = executionCmd.id || this.jediProxy.getNextCommandId();

        if (this.commandCancellationTokenSources.has(cmd.command)) {
            const ct = this.commandCancellationTokenSources.get(cmd.command);
            if (ct) {
                ct.cancel();
            }
        }

        const cancellation = new CancellationTokenSource();
        this.commandCancellationTokenSources.set(cmd.command, cancellation);
        executionCmd.token = cancellation.token;

        return this.jediProxy.sendCommand<R>(executionCmd).catch((reason) => {
            traceError(reason);
            return undefined;
        });
    }

    public sendCommandNonCancellableCommand(cmd: ICommand, token?: CancellationToken): Promise<R | undefined> {
        const executionCmd = <IExecutionCommand<R>>cmd;
        executionCmd.id = executionCmd.id || this.jediProxy.getNextCommandId();
        if (token) {
            executionCmd.token = token;
        }

        return this.jediProxy.sendCommand<R>(executionCmd).catch((reason) => {
            traceError(reason);
            return undefined;
        });
    }
}
