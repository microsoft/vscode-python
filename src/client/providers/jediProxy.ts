'use strict';

import * as child_process from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from './../common/configSettings';
import * as logger from './../common/logger';
import * as telemetryHelper from '../telemetry';
import { execPythonFile, getCustomEnvVarsSync, validatePath } from '../common/utils';
import { createDeferred, Deferred } from '../common/helpers';
import { getCustomEnvVars } from '../common/utils';
import { mergeEnvVariables } from '../common/envFileParser';
import { IPythonSettings, PythonSettings } from '../common/configSettings';

const IS_WINDOWS = /^win/.test(process.platform);

const pythonVSCodeTypeMappings = new Map<string, vscode.CompletionItemKind>();
pythonVSCodeTypeMappings.set('none', vscode.CompletionItemKind.Value);
pythonVSCodeTypeMappings.set('type', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('tuple', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dict', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dictionary', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('function', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('lambda', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('generator', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('class', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('instance', vscode.CompletionItemKind.Reference);
pythonVSCodeTypeMappings.set('method', vscode.CompletionItemKind.Method);
pythonVSCodeTypeMappings.set('builtin', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('builtinfunction', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('module', vscode.CompletionItemKind.Module);
pythonVSCodeTypeMappings.set('file', vscode.CompletionItemKind.File);
pythonVSCodeTypeMappings.set('xrange', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('slice', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('traceback', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('frame', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('buffer', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dictproxy', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('funcdef', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('property', vscode.CompletionItemKind.Property);
pythonVSCodeTypeMappings.set('import', vscode.CompletionItemKind.Module);
pythonVSCodeTypeMappings.set('keyword', vscode.CompletionItemKind.Keyword);
pythonVSCodeTypeMappings.set('constant', vscode.CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('variable', vscode.CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('value', vscode.CompletionItemKind.Value);
pythonVSCodeTypeMappings.set('param', vscode.CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('statement', vscode.CompletionItemKind.Keyword);

const pythonVSCodeSymbolMappings = new Map<string, vscode.SymbolKind>();
pythonVSCodeSymbolMappings.set('none', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('type', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('tuple', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('dict', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('dictionary', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('function', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('lambda', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('generator', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('class', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('instance', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('method', vscode.SymbolKind.Method);
pythonVSCodeSymbolMappings.set('builtin', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('builtinfunction', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('module', vscode.SymbolKind.Module);
pythonVSCodeSymbolMappings.set('file', vscode.SymbolKind.File);
pythonVSCodeSymbolMappings.set('xrange', vscode.SymbolKind.Array);
pythonVSCodeSymbolMappings.set('slice', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('traceback', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('frame', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('buffer', vscode.SymbolKind.Array);
pythonVSCodeSymbolMappings.set('dictproxy', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('funcdef', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('property', vscode.SymbolKind.Property);
pythonVSCodeSymbolMappings.set('import', vscode.SymbolKind.Module);
pythonVSCodeSymbolMappings.set('keyword', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('constant', vscode.SymbolKind.Constant);
pythonVSCodeSymbolMappings.set('variable', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('value', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('param', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('statement', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('boolean', vscode.SymbolKind.Boolean);
pythonVSCodeSymbolMappings.set('int', vscode.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('longlean', vscode.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('float', vscode.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('complex', vscode.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('string', vscode.SymbolKind.String);
pythonVSCodeSymbolMappings.set('unicode', vscode.SymbolKind.String);
pythonVSCodeSymbolMappings.set('list', vscode.SymbolKind.Array);

function getMappedVSCodeType(pythonType: string): vscode.CompletionItemKind {
    if (pythonVSCodeTypeMappings.has(pythonType)) {
        return pythonVSCodeTypeMappings.get(pythonType);
    }
    else {
        return vscode.CompletionItemKind.Keyword;
    }
}

function getMappedVSCodeSymbol(pythonType: string): vscode.SymbolKind {
    if (pythonVSCodeSymbolMappings.has(pythonType)) {
        return pythonVSCodeSymbolMappings.get(pythonType);
    }
    else {
        return vscode.SymbolKind.Variable;
    }
}

export enum CommandType {
    Arguments,
    Completions,
    Hover,
    Usages,
    Definitions,
    Symbols
}

var commandNames = new Map<CommandType, string>();
commandNames.set(CommandType.Arguments, "arguments");
commandNames.set(CommandType.Completions, "completions");
commandNames.set(CommandType.Definitions, "definitions");
commandNames.set(CommandType.Hover, "tooltip");
commandNames.set(CommandType.Usages, "usages");
commandNames.set(CommandType.Symbols, "names");

export class JediProxy implements vscode.Disposable {
    private proc: child_process.ChildProcess;
    private pythonSettings: PythonSettings;

    public constructor(private extensionRootDir: string, private workspacePath: string) {
        this.pythonSettings = PythonSettings.getInstance(vscode.Uri.file(workspacePath));
        this.lastKnownPythonInterpreter = this.pythonSettings.pythonPath
        this.pythonSettings.on('change', this.onPythonSettingsChanged.bind(this));
        vscode.workspace.onDidChangeConfiguration(this.onConfigChanged.bind(this));
        this.onConfigChanged();
        this.initialize(extensionRootDir);
    }
    public dispose() {
        this.killProcess();
    }
    private cmdId: number = 0;

    public getNextCommandId(): number {
        return this.cmdId++;
    }

    // keep track of the directory so we can re-spawn the process
    private pythonProcessCWD = "";
    private initialize(dir: string) {
        this.pythonProcessCWD = dir;
        this.spawnProcess(path.join(dir, "pythonFiles"));
    }

    // Check if settings changes
    private lastKnownPythonInterpreter: string;
    private onPythonSettingsChanged() {
        if (this.lastKnownPythonInterpreter === this.pythonSettings.pythonPath) {
            return;
        }
        this.killProcess();
        this.clearPendingRequests();
        this.initialize(this.pythonProcessCWD);
    }

    private clearPendingRequests() {
        this.commandQueue = [];
        this.commands.forEach(item => {
            item.deferred.resolve();
        });
        this.commands.clear();
    }
    private previousData = "";
    private commands = new Map<number, IExecutionCommand<ICommandResult>>();
    private commandQueue: number[] = [];

    private killProcess() {
        try {
            if (this.proc) {
                this.proc.kill();
            }
        }
        catch (ex) { }
        this.proc = null;
    }

    private handleError(source: string, errorMessage: string) {
        logger.error(source + ' jediProxy', `Error (${source}) ${errorMessage}`);
    }

    private spawnRetryAttempts = 0;
    private spawnProcess(dir: string) {
        try {
            let environmentVariables: Object & { [key: string]: string } = { 'PYTHONUNBUFFERED': '1' };
            let customEnvironmentVars = getCustomEnvVarsSync(vscode.Uri.file(dir));
            if (customEnvironmentVars) {
                environmentVariables = mergeEnvVariables(environmentVariables, customEnvironmentVars);
            }
            environmentVariables = mergeEnvVariables(environmentVariables);

            logger.log('child_process.spawn in jediProxy', 'Value of pythonSettings.pythonPath is :' + this.pythonSettings.pythonPath);
            const args = ["completion.py"];
            if (typeof this.pythonSettings.jediPath !== 'string' || this.pythonSettings.jediPath.length === 0) {
                if (Array.isArray(this.pythonSettings.devOptions) &&
                    this.pythonSettings.devOptions.some(item => item.toUpperCase().trim() === 'USERELEASEAUTOCOMP')) {
                    // Use standard version of jedi library
                    args.push('std');
                }
                else {
                    // Use preview version of jedi library
                    args.push('preview');
                }
            }
            else {
                args.push('custom');
                args.push(this.pythonSettings.jediPath);
            }
            if (Array.isArray(this.pythonSettings.autoComplete.preloadModules) &&
                this.pythonSettings.autoComplete.preloadModules.length > 0) {
                var modules = this.pythonSettings.autoComplete.preloadModules.filter(m => m.trim().length > 0).join(',');
                args.push(modules);
            }
            this.proc = child_process.spawn(this.pythonSettings.pythonPath, args, {
                cwd: dir,
                env: environmentVariables
            });
        }
        catch (ex) {
            return this.handleError("spawnProcess", ex.message);
        }
        this.proc.stderr.setEncoding('utf8');
        this.proc.stderr.on("data", (data: string) => {
            this.handleError("stderr", data);
        });
        this.proc.on("end", (end) => {
            logger.error('spawnProcess.end', "End - " + end);
        });
        this.proc.on("error", error => {
            this.handleError("error", error + '');
            this.spawnRetryAttempts++;
            if (this.spawnRetryAttempts < 10 && error && error.message &&
                error.message.indexOf('This socket has been ended by the other party') >= 0) {
                this.spawnProcess(dir);
            }
        });
        this.proc.stdout.setEncoding('utf8');
        this.proc.stdout.on("data", (data: string) => {
            //Possible there was an exception in parsing the data returned
            //So append the data then parse it
            var dataStr = this.previousData = this.previousData + data + "";
            var responses: any[];
            try {
                responses = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
                this.previousData = "";
            }
            catch (ex) {
                // Possible we've only received part of the data, hence don't clear previousData
                // Don't log errors when we haven't received the entire response
                if (ex.message.indexOf('Unexpected end of input') === -1 &&
                    ex.message.indexOf('Unexpected end of JSON input') === -1 &&
                    ex.message.indexOf('Unexpected token') === -1) {
                    this.handleError("stdout", ex.message);
                }
                return;
            }

            responses.forEach((response) => {
                // What's this, can't remember,
                // Great example of poorly written code (this whole file is a mess)
                // I think this needs to be removed, because this is misspelt, it is argments, 'U' is missing
                // And that case is handled further down
                // case CommandType.Arguments: {
                // Rewrite this mess to use stratergy..
                if (response["argments"]) {
                    var index = this.commandQueue.indexOf(cmd.id);
                    this.commandQueue.splice(index, 1);
                    return;
                }
                var responseId = <number>response["id"];

                var cmd = <IExecutionCommand<ICommandResult>>this.commands.get(responseId);
                if (typeof cmd === "object" && cmd !== null) {
                    this.commands.delete(responseId);
                    var index = this.commandQueue.indexOf(cmd.id);
                    this.commandQueue.splice(index, 1);

                    if (cmd.delay && typeof cmd.telemetryEvent === 'string') {
                        // cmd.delays.stop();
                        // telemetryHelper.sendTelemetryEvent(cmd.telemetryEvent, null, cmd.delays.toMeasures());
                    }

                    // Check if this command has expired
                    if (cmd.token.isCancellationRequested) {
                        cmd.deferred.resolve();
                        return;
                    }

                    switch (cmd.command) {
                        case CommandType.Completions: {
                            let results = <IAutoCompleteItem[]>response['results'];
                            results = Array.isArray(results) ? results : [];
                            results.forEach(item => {
                                const originalType = <string><any>item.type;
                                item.type = getMappedVSCodeType(originalType);
                                item.kind = getMappedVSCodeSymbol(originalType);
                                item.rawType = getMappedVSCodeType(originalType);
                            });

                            let completionResult: ICompletionResult = {
                                items: results,
                                requestId: cmd.id
                            };
                            cmd.deferred.resolve(completionResult);
                            break;
                        }
                        case CommandType.Definitions: {
                            let defs = <any[]>response['results'];
                            let defResult: IDefinitionResult = {
                                requestId: cmd.id,
                                definitions: []
                            };
                            if (defs.length > 0) {
                                defResult.definitions = defs.map(def => {
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

                            cmd.deferred.resolve(defResult);
                            break;
                        }
                        case CommandType.Hover: {
                            let defs = <any[]>response['results'];
                            var defResult: IHoverResult = {
                                requestId: cmd.id,
                                items: defs.map(def => {
                                    return {
                                        kind: getMappedVSCodeSymbol(def.type),
                                        description: def.description,
                                        signature: def.signature,
                                        docstring: def.docstring,
                                        text: def.text
                                    };
                                })
                            };

                            cmd.deferred.resolve(defResult);
                            break;
                        }
                        case CommandType.Symbols: {
                            let defs = <any[]>response['results'];
                            defs = Array.isArray(defs) ? defs : [];
                            var defResults: ISymbolResult = {
                                requestId: cmd.id,
                                definitions: []
                            };
                            defResults.definitions = defs.map<IDefinition>(def => {
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

                            cmd.deferred.resolve(defResults);
                            break;
                        }
                        case CommandType.Usages: {
                            let defs = <any[]>response['results'];
                            defs = Array.isArray(defs) ? defs : [];
                            var refResult: IReferenceResult = {
                                requestId: cmd.id,
                                references: defs.map(item => {
                                    return {
                                        columnIndex: item.column,
                                        fileName: item.fileName,
                                        lineIndex: item.line - 1,
                                        moduleName: item.moduleName,
                                        name: item.name
                                    };
                                }
                                )
                            };

                            cmd.deferred.resolve(refResult);
                            break;
                        }
                        case CommandType.Arguments: {
                            let defs = <any[]>response["results"];
                            cmd.deferred.resolve(<IArgumentsResult>{
                                requestId: cmd.id,
                                definitions: defs
                            });
                            break;
                        }
                    }
                }

                //Ok, check if too many pending requets
                if (this.commandQueue.length > 10) {
                    var items = this.commandQueue.splice(0, this.commandQueue.length - 10);
                    items.forEach(id => {
                        if (this.commands.has(id)) {
                            const cmd = this.commands.get(id);
                            try {
                                cmd.deferred.resolve(null);
                            }
                            catch (ex) {
                            }
                            this.commands.delete(id);
                        }
                    });
                }
            });
        });
    }

    public sendCommand<T extends ICommandResult>(cmd: ICommand<T>): Promise<T> {
        if (!this.proc) {
            return Promise.reject(new Error("Python proc not initialized"));
        }
        var executionCmd = <IExecutionCommand<T>>cmd;
        var payload = this.createPayload(executionCmd);
        executionCmd.deferred = createDeferred<T>();
        // if (typeof executionCmd.telemetryEvent === 'string') {
        //     executionCmd.delays = new telemetryHelper.Delays();
        // }
        try {
            this.proc.stdin.write(JSON.stringify(payload) + "\n");
            this.commands.set(executionCmd.id, executionCmd);
            this.commandQueue.push(executionCmd.id);
        }
        catch (ex) {
            console.error(ex);
            //If 'This socket is closed.' that means process didn't start at all (at least not properly)
            if (ex.message === "This socket is closed.") {

                this.killProcess();
            }
            else {
                this.handleError("sendCommand", ex.message);
            }
            return Promise.reject(ex);
        }
        return executionCmd.deferred.promise;
    }

    private createPayload<T extends ICommandResult>(cmd: IExecutionCommand<T>): any {
        var payload = {
            id: cmd.id,
            prefix: "",
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

    private lastKnownPythonPath: string = null;
    private additionalAutoCopletePaths: string[] = [];
    private getPathFromPythonCommand(args: string[]): Promise<string> {
        return execPythonFile(this.workspacePath, this.pythonSettings.pythonPath, args, this.workspacePath).then(stdout => {
            if (stdout.length === 0) {
                return "";
            }
            let lines = stdout.split(/\r?\n/g).filter(line => line.length > 0);
            return validatePath(lines[0]);
        }).catch(() => {
            return "";
        });
    }
    private onConfigChanged() {
        // We're only interested in changes to the python path
        if (this.lastKnownPythonPath === this.pythonSettings.pythonPath) {
            return;
        }

        this.lastKnownPythonPath = this.pythonSettings.pythonPath;
        let filePaths = [
            // Sysprefix
            this.getPathFromPythonCommand(["-c", "import sys;print(sys.prefix)"]),
            // exeucutable path
            this.getPathFromPythonCommand(["-c", "import sys;print(sys.executable)"]),
            // Python specific site packages
            this.getPathFromPythonCommand(["-c", "from distutils.sysconfig import get_python_lib; print(get_python_lib())"]),
            // Python global site packages, as a fallback in case user hasn't installed them in custom environment
            this.getPathFromPythonCommand(["-m", "site", "--user-site"]),
        ];

        let PYTHONPATH: string = process.env['PYTHONPATH'];
        if (typeof PYTHONPATH !== 'string') {
            PYTHONPATH = '';
        }
        let customEnvironmentVars = getCustomEnvVarsSync(vscode.Uri.file(this.pythonProcessCWD));
        if (customEnvironmentVars && customEnvironmentVars['PYTHONPATH']) {
            let PYTHONPATHFromEnvFile = customEnvironmentVars['PYTHONPATH'] as string;
            if (!path.isAbsolute(PYTHONPATHFromEnvFile) && this.workspacePath === 'string') {
                PYTHONPATHFromEnvFile = path.resolve(this.workspacePath, PYTHONPATHFromEnvFile);
            }
            PYTHONPATH += (PYTHONPATH.length > 0 ? + path.delimiter : '') + PYTHONPATHFromEnvFile;
        }
        if (typeof PYTHONPATH === 'string' && PYTHONPATH.length > 0) {
            filePaths.push(Promise.resolve(PYTHONPATH.trim()));
        }
        Promise.all<string>(filePaths).then(paths => {
            // Last item return a path, we need only the folder
            if (paths[1].length > 0) {
                paths[1] = path.dirname(paths[1]);
            }

            // On windows we also need the libs path (second item will return c:\xxx\lib\site-packages)
            // This is returned by "from distutils.sysconfig import get_python_lib; print(get_python_lib())"
            if (IS_WINDOWS && paths[2].length > 0) {
                paths.splice(3, 0, path.join(paths[2], ".."));
            }
            this.additionalAutoCopletePaths = paths.filter(p => p.length > 0);
        });
    }

    private getConfig() {
        // Add support for paths relative to workspace
        let extraPaths = this.pythonSettings.autoComplete.extraPaths.map(extraPath => {
            if (path.isAbsolute(extraPath)) {
                return extraPath;
            }
            if (typeof this.workspacePath !== 'string') {
                return '';
            }
            return path.join(this.workspacePath, extraPath);
        });

        // Always add workspace path into extra paths
        if (typeof this.workspacePath === 'string') {
            extraPaths.unshift(this.workspacePath);
        }

        let distinctExtraPaths = extraPaths.concat(this.additionalAutoCopletePaths)
            .filter(value => value.length > 0)
            .filter((value, index, self) => self.indexOf(value) === index);

        return {
            extraPaths: distinctExtraPaths,
            useSnippets: false,
            caseInsensitiveCompletion: true,
            showDescriptions: true,
            fuzzyMatcher: true
        };
    }
}
export interface ICommand<T extends ICommandResult> {
    telemetryEvent?: string;
    command: CommandType;
    source?: string;
    fileName: string;
    lineIndex: number;
    columnIndex: number;
}

interface IExecutionCommand<T extends ICommandResult> extends ICommand<T> {
    id?: number;
    deferred?: Deferred<T>;
    token: vscode.CancellationToken;
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
    type: vscode.CompletionItemKind;
    rawType: vscode.CompletionItemKind;
    kind: vscode.SymbolKind;
    text: string;
    description: string;
    raw_docstring: string;
    rightLabel: string;
}
interface IDefinitionRange {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}
export interface IDefinition {
    rawType: string;
    type: vscode.CompletionItemKind;
    kind: vscode.SymbolKind;
    text: string;
    fileName: string;
    container: string;
    range: IDefinitionRange;
}

export interface IHoverItem {
    kind: vscode.SymbolKind;
    text: string;
    description: string;
    docstring: string;
    signature: string;
}

export class JediProxyHandler<R extends ICommandResult> implements vscode.Disposable {
    private commandCancellationTokenSources: Map<CommandType, vscode.CancellationTokenSource>;

    public get JediProxy(): JediProxy {
        return this.jediProxy;
    }

    public constructor(private jediProxy: JediProxy = null) {
        this.commandCancellationTokenSources = new Map<CommandType, vscode.CancellationTokenSource>();
    }
    public dispose() {
        this.jediProxy.dispose();
    }
    public sendCommand(cmd: ICommand<R>, token?: vscode.CancellationToken): Promise<R> {
        var executionCmd = <IExecutionCommand<R>>cmd;
        executionCmd.id = executionCmd.id || this.jediProxy.getNextCommandId();

        if (this.commandCancellationTokenSources.has(cmd.command)) {
            const cancellation = this.commandCancellationTokenSources.get(cmd.command);
            cancellation.cancel();
        }

        const cancellation = new vscode.CancellationTokenSource();
        this.commandCancellationTokenSources.set(cmd.command, cancellation);
        executionCmd.token = cancellation.token;

        return this.jediProxy.sendCommand<R>(executionCmd)
            .catch(reason => {
                console.error(reason);
                return undefined;
            });
    }

    public sendCommandNonCancellableCommand(cmd: ICommand<R>, token?: vscode.CancellationToken): Promise<R> {
        var executionCmd = <IExecutionCommand<R>>cmd;
        executionCmd.id = executionCmd.id || this.jediProxy.getNextCommandId();
        executionCmd.token = token;

        return this.jediProxy.sendCommand<R>(executionCmd)
            .catch(reason => {
                console.error(reason);
                return undefined;
            });
    }
}
