// tslint:disable:quotemark ordered-imports promise-must-complete member-ordering no-any prefer-template cyclomatic-complexity no-empty no-multiline-string one-line no-invalid-template-strings no-suspicious-comment no-var-self
"use strict";

// This line should always be right on top.
// tslint:disable:no-any no-floating-promises
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}
import * as fs from "fs";
import * as path from "path";
import { Handles, InitializedEvent, OutputEvent, Scope, Source, StackFrame, StoppedEvent, TerminatedEvent, Thread, Variable, LoggingDebugSession, logger } from "vscode-debugadapter";
import { ThreadEvent } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { DEBUGGER } from '../../client/telemetry/constants';
import { DebuggerTelemetry } from '../../client/telemetry/types';
import { isNotInstalledError } from '../common/helpers';
import { enum_EXCEPTION_STATE, IPythonBreakpoint, IPythonException, PythonBreakpointConditionKind, PythonBreakpointPassCountKind, PythonEvaluationResultReprKind } from "./Common/Contracts";
import { IDebugServer, IPythonEvaluationResult, IPythonModule, IPythonStackFrame, IPythonThread } from "./Common/Contracts";
import { AttachRequestArguments, DebugOptions, LaunchRequestArguments, PythonEvaluationResultFlags, TelemetryEvent } from "./Common/Contracts";
import { getPythonExecutable, validatePath } from './Common/Utils';
import { DebugClient } from "./DebugClients/DebugClient";
import { CreateAttachDebugClient, CreateLaunchDebugClient } from "./DebugClients/DebugFactory";
import { BaseDebugServer } from "./DebugServers/BaseDebugServer";
import { PythonProcess } from "./PythonProcess";
import { IS_WINDOWS } from './Common/Utils';
import { sendPerformanceTelemetry, capturePerformanceTelemetry, PerformanceTelemetryCondition } from "./Common/telemetry";
import { LogLevel } from "vscode-debugadapter/lib/logger";

const CHILD_ENUMEARATION_TIMEOUT = 5000;

interface IDebugVariable {
    variables: IPythonEvaluationResult[];
    evaluateChildren?: Boolean;
}

export class PythonDebugger extends LoggingDebugSession {
    private _variableHandles: Handles<IDebugVariable>;
    private _pythonStackFrames: Handles<IPythonStackFrame>;
    private breakPointCounter: number = 0;
    private registeredBreakpoints: Map<number, IPythonBreakpoint>;
    private registeredBreakpointsByFileName: Map<string, IPythonBreakpoint[]>;
    private debuggerLoaded: Promise<any>;
    private debuggerLoadedPromiseResolve: () => void;
    private debugClient?: DebugClient<{}>;
    private configurationDone: Promise<any>;
    private configurationDonePromiseResolve?: () => void;
    private lastException?: IPythonException;
    private _supportsRunInTerminalRequest: boolean;
    private terminateEventSent: boolean;
    public constructor(debuggerLinesStartAt1: boolean, isServer: boolean) {
        super(path.join(__dirname, '..', '..', '..', 'debug.log'), debuggerLinesStartAt1, isServer === true);
        this._variableHandles = new Handles<IDebugVariable>();
        this._pythonStackFrames = new Handles<IPythonStackFrame>();
        this.registeredBreakpoints = new Map<number, IPythonBreakpoint>();
        this.registeredBreakpointsByFileName = new Map<string, IPythonBreakpoint[]>();
        this.debuggerLoaded = new Promise(resolve => {
            this.debuggerLoadedPromiseResolve = resolve;
        });
    }
    // tslint:disable-next-line:no-unnecessary-override
    @sendPerformanceTelemetry(PerformanceTelemetryCondition.stoppedEvent)
    public sendEvent(event: DebugProtocol.Event): void {
        super.sendEvent(event);
    }
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        response.body!.supportsEvaluateForHovers = true;
        response.body!.supportsConditionalBreakpoints = true;
        response.body!.supportsConfigurationDoneRequest = true;
        response.body!.supportsEvaluateForHovers = false;
        response.body!.supportsFunctionBreakpoints = false;
        response.body!.supportsSetVariable = true;
        response.body!.exceptionBreakpointFilters = [
            {
                label: "All Exceptions",
                filter: "all"
            },
            {
                label: "Uncaught Exceptions",
                filter: "uncaught"
            }
        ];
        if (typeof args.supportsRunInTerminalRequest === 'boolean') {
            this._supportsRunInTerminalRequest = args.supportsRunInTerminalRequest;
        }
        this.sendResponse(response);
        // now we are ready to accept breakpoints -> fire the initialized event to give UI a chance to set breakpoints
        this.sendEvent(new InitializedEvent());
    }

    private pythonProcess?: PythonProcess;
    private debugServer: BaseDebugServer;

    private startDebugServer(): Promise<IDebugServer> {
        let programDirectory = '';
        if ((this.launchArgs && this.launchArgs.program) || (this.attachArgs && this.attachArgs.localRoot)) {
            programDirectory = this.launchArgs ? path.dirname(this.launchArgs.program) : this.attachArgs.localRoot;
        }
        if (this.launchArgs && typeof this.launchArgs.cwd === 'string' && this.launchArgs.cwd.length > 0 && this.launchArgs.cwd !== 'null') {
            programDirectory = this.launchArgs.cwd;
        }
        this.pythonProcess = new PythonProcess(0, "", programDirectory);
        this.debugServer = this.debugClient!.CreateDebugServer(this.pythonProcess!);
        this.InitializeEventHandlers();
        return this.debugServer.Start();
    }
    private stopDebugServer() {
        if (this.debugClient) {
            this.debugClient!.Stop();
            this.debugClient = undefined;
        }
        if (this.pythonProcess) {
            this.pythonProcess!.Kill();
            this.pythonProcess = undefined;
        }
        this.terminateEventSent = true;
        this.sendEvent(new TerminatedEvent());
    }
    private InitializeEventHandlers() {
        const pythonProcess = this.pythonProcess!;
        pythonProcess.on("last", arg => this.onLastCommand());
        pythonProcess.on("threadExited", arg => this.onPythonThreadExited(arg));
        pythonProcess.on("moduleLoaded", arg => this.onPythonModuleLoaded(arg));
        pythonProcess.on("threadCreated", arg => this.onPythonThreadCreated(arg));
        pythonProcess.on("processLoaded", arg => this.onPythonProcessLoaded(arg));
        pythonProcess.on("output", (pyThread, output) => this.onDebuggerOutput(pyThread, output, 'stdout'));
        pythonProcess.on("exceptionRaised", (pyThread, ex) => this.onPythonException(pyThread, ex));
        pythonProcess.on("breakpointHit", (pyThread, breakpointId) => this.onBreakpointHit(pyThread, breakpointId));
        pythonProcess.on("stepCompleted", (pyThread) => this.onStepCompleted(pyThread));
        pythonProcess.on("detach", () => this.onDetachDebugger());
        pythonProcess.on("error", ex => this.onDebuggerOutput(undefined, ex, 'stderr'));
        pythonProcess.on("asyncBreakCompleted", arg => this.onPythonProcessPaused(arg));

        this.debugServer.on("detach", () => this.onDetachDebugger());
    }
    private onLastCommand() {
        this.terminateEventSent = true;
        // When running in terminals, and if there are any errors, the PTVSD library
        // first sends the LAST command (meaning everything has ended) and then sends the stderr and stdout messages.
        // I.e. to us, it looks as though everything is done and completed, when it isn't.
        // A simple solution is to tell vscode that it has ended 500ms later (giving us time to receive any messages from stderr/stdout from ptvsd).
        setTimeout(() => this.sendEvent(new TerminatedEvent()), 500);
    }
    private onDetachDebugger() {
        this.stopDebugServer();
    }
    private onPythonThreadCreated(pyThread: IPythonThread) {
        this.sendEvent(new ThreadEvent("started", pyThread.Id));
    }
    private onStepCompleted(pyThread: IPythonThread) {
        this.sendEvent(new StoppedEvent("step", pyThread.Id));
    }
    private onPythonException(pyThread: IPythonThread, ex: IPythonException) {
        this.lastException = ex;
        this.sendEvent(new StoppedEvent("exception", pyThread.Id, `${ex.TypeName}, ${ex.Description}`));
        this.sendEvent(new OutputEvent(`${ex.TypeName}, ${ex.Description}\n`, "stderr"));
    }
    private onPythonThreadExited(pyThread: IPythonThread) {
        this.sendEvent(new ThreadEvent("exited", pyThread.Id));
    }
    private onPythonProcessPaused(pyThread: IPythonThread) {
        this.sendEvent(new StoppedEvent("user request", pyThread.Id));
    }
    private onPythonModuleLoaded(module: IPythonModule) {
    }
    @sendPerformanceTelemetry(PerformanceTelemetryCondition.always)
    private onPythonProcessLoaded(pyThread?: IPythonThread) {
        if (this.entryResponse) {
            this.sendResponse(this.entryResponse);
        }
        this.debuggerLoadedPromiseResolve();
        if (this.launchArgs && !this.launchArgs.console) {
            this.launchArgs.console = 'none';
        }
        // If launching the integrated terminal is not supported, then defer to external terminal
        // that will be displayed by our own code.
        if (!this._supportsRunInTerminalRequest && this.launchArgs && this.launchArgs.console === 'integratedTerminal') {
            this.launchArgs.console = 'externalTerminal';
        }
        if (!this.launchArgs || this.launchArgs.noDebug !== true) {
            // tslint:disable-next-line:no-non-null-assertion
            const thread = pyThread!;
            if (this.launchArgs && this.launchArgs.stopOnEntry === true) {
                this.sendEvent(new StoppedEvent("entry", thread.Id));
            } else if (this.launchArgs && this.launchArgs.stopOnEntry === false) {
                this.configurationDone.then(() => {
                    this.pythonProcess!.SendResumeThread(thread.Id);
                });
            } else {
                this.pythonProcess!.SendResumeThread(thread.Id);
            }
        }
    }

    private onDebuggerOutput(pyThread: IPythonThread | undefined, output: string, outputChannel: 'stdout' | 'stderr') {
        if (this.entryResponse) {
            // Sometimes we can get output from PTVSD even before things load.
            // E.g. if the program didn't even run (e.g. simple one liner with invalid syntax).
            // But we need to tell vscode that the debugging has started, so we can send error messages.
            this.sendResponse(this.entryResponse);
            this.debuggerLoadedPromiseResolve();
            this.entryResponse = undefined;
        }
        this.sendEvent(new OutputEvent(output, outputChannel));
    }
    private entryResponse?: DebugProtocol.LaunchResponse;
    private launchArgs: LaunchRequestArguments;
    private attachArgs: AttachRequestArguments;
    private canStartDebugger(): Promise<boolean> {
        return Promise.resolve(true);
    }
    @capturePerformanceTelemetry('launch')
    protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
        if (args.diagnosticLogging === true) {
            logger.setup(LogLevel.Verbose, args.logToFile === true);
        }
        // Some versions may still exist with incorrect launch.json values
        const setting = '${config.python.pythonPath}';
        if (args.pythonPath === setting) {
            return this.sendErrorResponse(response, 2001, `Invalid launch.json (re-create it or replace 'config.python.pythonPath' with 'config:python.pythonPath')`);
        }
        // Add support for specifying just the directory where the python executable will be located
        // E.g. virtual directory name
        try {
            args.pythonPath = getPythonExecutable(args.pythonPath);
        }
        catch (ex) {
        }
        if (Array.isArray(args.debugOptions) && args.debugOptions.indexOf("Pyramid") >= 0) {
            const pserve = IS_WINDOWS ? "pserve.exe" : "pserve";
            if (fs.existsSync(args.pythonPath)) {
                args.program = path.join(path.dirname(args.pythonPath), pserve);
            }
            else {
                args.program = pserve;
            }
        }
        // Confirm the file exists
        if (typeof args.module !== 'string' || args.module.length === 0) {
            if (!fs.existsSync(args.program)) {
                return this.sendErrorResponse(response, 2001, `File does not exist. "${args.program}"`);
            }
        }
        else {
            // When using modules ensure the cwd has been provided
            if (typeof args.cwd !== 'string' || args.cwd.length === 0 || (this.launchArgs && this.launchArgs.cwd === 'null')) {
                return this.sendErrorResponse(response, 2001, `'cwd' in 'launch.json' needs to point to the working directory`);
            }
        }

        let programDirectory = '';
        if (args && args.program) {
            programDirectory = path.dirname(args.program);
        }
        if (args && typeof args.cwd === 'string' && args.cwd.length > 0 && args.cwd !== 'null') {
            programDirectory = args.cwd;
        }
        if (programDirectory.length > 0 && fs.existsSync(path.join(programDirectory, 'pyenv.cfg'))) {
            this.sendEvent(new OutputEvent(`Warning 'pyenv.cfg' can interfere with the debugger. Please rename or delete this file (temporary solution)`));
        }

        const telemetryProps: DebuggerTelemetry = {
            trigger: 'launch',
            console: args.console,
            debugOptions: (Array.isArray(args.debugOptions) ? args.debugOptions : []).join(","),
            pyspark: typeof args.pythonPath === 'string' && args.pythonPath.indexOf('spark-submit') > 0,
            hasEnvVars: args.env && typeof args.env === "object" && Object.keys(args.env).length > 0
        };
        this.sendEvent(new TelemetryEvent(DEBUGGER, telemetryProps));

        this.launchArgs = args;
        this.debugClient = CreateLaunchDebugClient(args, this, this._supportsRunInTerminalRequest);
        this.configurationDone = new Promise(resolve => {
            this.configurationDonePromiseResolve = resolve;
        });

        this.entryResponse = response;
        const that = this;

        this.startDebugServer().then(dbgServer => {
            return that.debugClient!.LaunchApplicationToDebug(dbgServer);
        }).catch(error => {
            this.sendEvent(new OutputEvent(`${error}${'\n'}`, "stderr"));
            response.success = false;
            let errorMsg = typeof error === "string" ? error : ((error.message && error.message.length > 0) ? error.message : error);
            if (isNotInstalledError(error)) {
                errorMsg = `Failed to launch the Python Process, please validate the path '${this.launchArgs.pythonPath}'`;
            }
            this.sendErrorResponse(response, 200, errorMsg);
        });
    }
    protected attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments) {
        if ((args as any).diagnosticLogging === true) {
            logger.setup(LogLevel.Verbose, (args as any).logToFile === true);
        }
        this.sendEvent(new TelemetryEvent(DEBUGGER, { trigger: 'attach' }));

        this.attachArgs = args;
        this.debugClient = CreateAttachDebugClient(args, this);
        this.entryResponse = response;
        const that = this;

        this.canStartDebugger().then(() => {
            return this.startDebugServer();
        }).then(dbgServer => {
            return that.debugClient!.LaunchApplicationToDebug(dbgServer);
        }).catch(error => {
            this.sendEvent(new OutputEvent(`${error}${'\n'}`, "stderr"));
            this.sendErrorResponse(that.entryResponse!, 2000, error);
        });
    }
    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        // Tell debugger we have loaded the breakpoints
        if (this.configurationDonePromiseResolve) {
            this.configurationDonePromiseResolve!();
            this.configurationDonePromiseResolve = undefined;
        }
        this.sendResponse(response);
    }
    private onBreakpointHit(pyThread: IPythonThread, breakpointId: number) {
        // Break only if the breakpoint exists and it is enabled
        if (this.registeredBreakpoints.has(breakpointId) && this.registeredBreakpoints.get(breakpointId)!.Enabled === true) {
            this.sendEvent(new StoppedEvent("breakpoint", pyThread.Id));
        }
        else {
            this.pythonProcess!.SendResumeThread(pyThread.Id);
        }
    }
    private buildBreakpointDetails(filePath: string, line: number, condition: string): IPythonBreakpoint {
        let isDjangoFile = false;
        if (this.launchArgs &&
            Array.isArray(this.launchArgs.debugOptions) &&
            this.launchArgs.debugOptions.indexOf(DebugOptions.DjangoDebugging) >= 0) {
            isDjangoFile = filePath.toUpperCase().endsWith(".HTML");
        }

        condition = typeof condition === "string" ? condition : "";

        return {
            Condition: condition,
            ConditionKind: condition.length === 0 ? PythonBreakpointConditionKind.Always : PythonBreakpointConditionKind.WhenTrue,
            Filename: filePath,
            Id: this.breakPointCounter += 1,
            LineNo: line,
            PassCount: 0,
            PassCountKind: PythonBreakpointPassCountKind.Always,
            IsDjangoBreakpoint: isDjangoFile,
            Enabled: true
        };
    }
    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        this.debuggerLoaded.then(() => {
            if (this.terminateEventSent) {
                response.body = {
                    breakpoints: []
                };
                return this.sendResponse(response);
            }
            if (!this.registeredBreakpointsByFileName.has(args.source.path!)) {
                this.registeredBreakpointsByFileName.set(args.source.path!, []);
            }

            const breakpoints: { verified: boolean, line: number }[] = [];
            const linesToAdd = args.breakpoints!.map(b => b.line);
            const registeredBks = this.registeredBreakpointsByFileName.get(args.source.path!)!;
            const linesToRemove = registeredBks.map(b => b.LineNo).filter(oldLine => linesToAdd.indexOf(oldLine) === -1);

            // Always add new breakpoints, don't re-enable previous breakpoints,
            // Cuz sometimes some breakpoints get added too early (e.g. in django) and don't get registeredBks
            // and the response comes back indicating it wasn't set properly.
            // However, at a later point in time, the program breaks at that point!!!
            const linesToAddPromises = args.breakpoints!.map(bk => {
                return new Promise(resolve => {
                    let breakpoint: IPythonBreakpoint;
                    const existingBreakpointsForThisLine = registeredBks.filter(registeredBk => registeredBk.LineNo === bk.line);
                    if (existingBreakpointsForThisLine.length > 0) {
                        // We have an existing breakpoint for this line
                        // just enable that
                        breakpoint = existingBreakpointsForThisLine[0];
                        breakpoint.Enabled = true;
                    }
                    else {
                        breakpoint = this.buildBreakpointDetails(this.convertClientPathToDebugger(args.source.path!), bk.line, bk.condition!);
                    }

                    this.pythonProcess!.BindBreakpoint(breakpoint).then(() => {
                        this.registeredBreakpoints.set(breakpoint.Id, breakpoint);
                        breakpoints.push({ verified: true, line: bk.line });
                        registeredBks.push(breakpoint);
                        resolve();
                    }).catch(reason => {
                        this.registeredBreakpoints.set(breakpoint.Id, breakpoint);
                        breakpoints.push({ verified: false, line: bk.line });
                        registeredBks.push(breakpoint);
                        resolve();
                    });
                });
            });

            const linesToRemovePromises = linesToRemove.map(line => {
                return new Promise(resolve => {
                    const bookmarks = this.registeredBreakpointsByFileName.get(args.source.path!)!;
                    const bk = bookmarks.filter(b => b.LineNo === line)[0];
                    // Ok, we won't get a response back, so update the breakpoints list  indicating this has been disabled
                    bk.Enabled = false;
                    this.pythonProcess!.DisableBreakPoint(bk);
                    resolve();
                });
            });

            const promises = linesToAddPromises.concat(linesToRemovePromises);
            Promise.all(promises).then(() => {
                response.body = {
                    breakpoints: breakpoints
                };

                this.sendResponse(response);

                // Tell debugger we have loaded the breakpoints
                if (this.configurationDonePromiseResolve) {
                    this.configurationDonePromiseResolve!();
                    this.configurationDonePromiseResolve = undefined;
                }
            }).catch(error => this.sendErrorResponse(response, 2000, error));
        });
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        const threads: Thread[] = [];
        if (this.pythonProcess) {
            this.pythonProcess!.Threads.forEach(t => {
                threads.push(new Thread(t.Id, t.Name));
            });
        }

        response.body = {
            threads: threads
        };
        this.sendResponse(response);
    }
    protected convertDebuggerPathToClient(remotePath: string): string {
        if (this.attachArgs && this.attachArgs.localRoot && this.attachArgs.remoteRoot) {
            let path2 = path.win32;
            if (this.attachArgs.remoteRoot.indexOf('/') !== -1) {
                path2 = path.posix;
            }
            const pathRelativeToSourceRoot = path2.relative(this.attachArgs.remoteRoot, remotePath);
            return path.resolve(this.attachArgs.localRoot, pathRelativeToSourceRoot);
        } else {
            return remotePath;
        }
    }
    protected convertClientPathToDebugger(clientPath: string): string {
        if (this.attachArgs && this.attachArgs.localRoot && this.attachArgs.remoteRoot) {
            // get the part of the path that is relative to the client root
            const pathRelativeToClientRoot = path.relative(this.attachArgs.localRoot, clientPath);
            // resolve from the remote source root
            let path2 = path.win32;
            if (this.attachArgs.remoteRoot.indexOf('/') !== -1) {
                path2 = path.posix;
            }
            return path2.resolve(this.attachArgs.remoteRoot, pathRelativeToClientRoot);
        } else {
            return clientPath;
        }
    }
    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        this.debuggerLoaded.then(() => {
            if (this.terminateEventSent || !this.pythonProcess || !this.pythonProcess!.Threads.has(args.threadId)) {
                response.body = {
                    stackFrames: []
                };
                return this.sendResponse(response);
            }

            const pyThread = this.pythonProcess!.Threads.get(args.threadId)!;
            let maxFrames = typeof args.levels === "number" && args.levels > 0 ? args.levels : pyThread.Frames.length - 1;
            maxFrames = maxFrames < pyThread.Frames.length ? maxFrames : pyThread.Frames.length;

            const frames = pyThread.Frames.map(frame => {
                return validatePath(this.convertDebuggerPathToClient(frame.FileName)).then(fileName => {
                    const frameId = this._pythonStackFrames.create(frame);
                    if (fileName.length === 0) {
                        return new StackFrame(frameId, frame.FunctionName);
                    }
                    else {
                        return new StackFrame(frameId, frame.FunctionName,
                            new Source(path.basename(frame.FileName), fileName),
                            this.convertDebuggerLineToClient(frame.LineNo - 1),
                            0);
                    }
                });
            });
            Promise.all<StackFrame>(frames).then(resolvedFrames => {
                response.body = {
                    stackFrames: resolvedFrames
                };

                this.sendResponse(response);
            });
        });
    }
    @capturePerformanceTelemetry('stepIn')
    protected stepInRequest(response: DebugProtocol.StepInResponse): void {
        this.sendResponse(response);
        this.pythonProcess!.SendStepInto(this.pythonProcess!.LastExecutedThread.Id);
    }
    @capturePerformanceTelemetry('stepOut')
    protected stepOutRequest(response: DebugProtocol.StepInResponse): void {
        this.sendResponse(response);
        this.pythonProcess!.SendStepOut(this.pythonProcess!.LastExecutedThread.Id);
    }
    @capturePerformanceTelemetry('continue')
    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
        this.pythonProcess!.SendContinue().then(() => {
            this.sendResponse(response);
        }).catch(error => this.sendErrorResponse(response, 2000, error));
    }
    @capturePerformanceTelemetry('next')
    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        this.sendResponse(response);
        this.pythonProcess!.SendStepOver(this.pythonProcess!.LastExecutedThread.Id);
    }
    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        this.debuggerLoaded.then(() => {
            const frame = this._pythonStackFrames.get(args.frameId!)!;
            if (this.terminateEventSent || !frame || !this.pythonProcess) {
                response.body = {
                    result: '',
                    variablesReference: 0
                };
                return this.sendResponse(response);
            }

            this.pythonProcess!.ExecuteText(args.expression, PythonEvaluationResultReprKind.Normal, frame).then(result => {
                let variablesReference = 0;
                // If this value can be expanded, then create a vars ref for user to expand it
                if (result.IsExpandable) {
                    const parentVariable: IDebugVariable = {
                        variables: [result],
                        evaluateChildren: true
                    };
                    variablesReference = this._variableHandles.create(parentVariable);
                }

                response.body = {
                    result: result.StringRepr,
                    variablesReference: variablesReference
                };
                this.sendResponse(response);
            }).catch(error => this.sendErrorResponse(response, 2000, error));
        });
    }
    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        this.debuggerLoaded.then(() => {
            const frame = this._pythonStackFrames.get(args.frameId)!;
            if (this.terminateEventSent || !frame || !this.pythonProcess) {
                response.body = {
                    scopes: []
                };
                return this.sendResponse(response);
            }

            const scopes: Scope[] = [];
            if (this.lastException && this.lastException!.Description.length > 0) {
                const values: IDebugVariable = {
                    variables: [{
                        Frame: frame, Expression: 'Type',
                        Flags: PythonEvaluationResultFlags.Raw,
                        StringRepr: this.lastException!.TypeName,
                        TypeName: 'string', IsExpandable: false, HexRepr: '',
                        ChildName: '', ExceptionText: '', Length: 0, Process: undefined
                    },
                    {
                        Frame: frame, Expression: 'Description',
                        Flags: PythonEvaluationResultFlags.Raw,
                        StringRepr: this.lastException!.Description,
                        TypeName: 'string', IsExpandable: false, HexRepr: '',
                        ChildName: '', ExceptionText: '', Length: 0, Process: undefined
                    }],
                    evaluateChildren: false
                };
                scopes.push(new Scope("Exception", this._variableHandles.create(values), false));
                this.lastException = undefined;
            }
            if (Array.isArray(frame.Locals) && frame.Locals.length > 0) {
                const values: IDebugVariable = { variables: frame.Locals };
                scopes.push(new Scope("Local", this._variableHandles.create(values), false));
            }
            if (Array.isArray(frame.Parameters) && frame.Parameters.length > 0) {
                const values: IDebugVariable = { variables: frame.Parameters };
                scopes.push(new Scope("Arguments", this._variableHandles.create(values), false));
            }
            response.body = { scopes };
            this.sendResponse(response);
        });
    }
    protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
        const varRef = this._variableHandles.get(args.variablesReference)!;

        if (varRef.evaluateChildren !== true) {
            const variables: Variable[] = [];
            varRef.variables.forEach(variable => {
                let variablesReference = 0;
                // If this value can be expanded, then create a vars ref for user to expand it
                if (variable.IsExpandable) {
                    const parentVariable: IDebugVariable = {
                        variables: [variable],
                        evaluateChildren: true
                    };
                    variablesReference = this._variableHandles.create(parentVariable);
                }

                variables.push({
                    name: variable.Expression,
                    value: variable.StringRepr,
                    variablesReference: variablesReference
                });
            });

            response.body = {
                variables: variables
            };

            return this.sendResponse(response);
        }
        else {
            // Ok, we need to evaluate the children of the current variable.
            const variables: Variable[] = [];
            const promises = varRef.variables.map(variable => {
                return variable.Process!.EnumChildren(variable.Expression, variable.Frame, CHILD_ENUMEARATION_TIMEOUT).then(children => {
                    children.forEach(child => {
                        let variablesReference = 0;
                        // If this value can be expanded, then create a vars ref for user to expand it
                        if (child.IsExpandable) {
                            const childVariable: IDebugVariable = {
                                variables: [child],
                                evaluateChildren: true
                            };
                            variablesReference = this._variableHandles.create(childVariable);
                        }

                        variables.push({
                            name: child.ChildName,
                            value: child.StringRepr,
                            variablesReference: variablesReference
                        });
                    });
                });
            });

            Promise.all(promises).then(() => {
                response.body = {
                    variables: variables
                };

                return this.sendResponse(response);
            }).catch(error => this.sendErrorResponse(response, 2001, error));
        }
    }
    protected pauseRequest(response: DebugProtocol.PauseResponse): void {
        this.pythonProcess!.Break();
        this.sendResponse(response);
    }
    protected setExceptionBreakPointsRequest(response: DebugProtocol.SetExceptionBreakpointsResponse, args: DebugProtocol.SetExceptionBreakpointsArguments): void {
        this.debuggerLoaded.then(() => {
            if (this.terminateEventSent) {
                return this.sendResponse(response);
            }
            let mode = enum_EXCEPTION_STATE.BREAK_MODE_NEVER;
            if (args.filters.indexOf("uncaught") >= 0) {
                mode = enum_EXCEPTION_STATE.BREAK_MODE_UNHANDLED;
            }
            if (args.filters.indexOf("all") >= 0) {
                mode = enum_EXCEPTION_STATE.BREAK_MODE_ALWAYS;
            }
            const exToIgnore = new Map<string, enum_EXCEPTION_STATE>();
            const exceptionHandling = this.launchArgs ? this.launchArgs.exceptionHandling : null;
            if (exceptionHandling) {
                if (Array.isArray(exceptionHandling.ignore)) {
                    exceptionHandling.ignore.forEach(exType => {
                        exToIgnore.set(exType, enum_EXCEPTION_STATE.BREAK_MODE_NEVER);
                    });
                }
                if (Array.isArray(exceptionHandling.always)) {
                    exceptionHandling.always.forEach(exType => {
                        exToIgnore.set(exType, enum_EXCEPTION_STATE.BREAK_MODE_ALWAYS);
                    });
                }
                if (Array.isArray(exceptionHandling.unhandled)) {
                    exceptionHandling.unhandled.forEach(exType => {
                        exToIgnore.set(exType, enum_EXCEPTION_STATE.BREAK_MODE_UNHANDLED);
                    });
                }

            }
            // Ignore StopIteration and GeneratorExit as they are used for
            // control flow and not error conditions.
            if (!exToIgnore.has('StopIteration')) {
                exToIgnore.set('StopIteration', enum_EXCEPTION_STATE.BREAK_MODE_NEVER);
            }
            if (!exToIgnore.has('GeneratorExit')) {
                exToIgnore.set('GeneratorExit', enum_EXCEPTION_STATE.BREAK_MODE_NEVER);
            }
            if (this.pythonProcess) {
                this.pythonProcess!.SendExceptionInfo(mode, exToIgnore);
            }
            this.sendResponse(response);
        });
    }
    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments) {
        this.stopDebugServer();
        this.sendResponse(response);
    }
    protected setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments) {
        const variable = this._variableHandles.get(args.variablesReference)!.variables.find(v => v.ChildName === args.name);
        if (!variable) {
            return this.sendErrorResponse(response, 2000, 'Variable reference not found');
        }
        this.pythonProcess!.ExecuteText(`${args.name} = ${args.value}`, PythonEvaluationResultReprKind.Normal, variable.Frame).then(() => {
            return this.pythonProcess!.ExecuteText(args.name, PythonEvaluationResultReprKind.Normal, variable.Frame).then(result => {
                // If this value can be expanded, then create a vars ref for user to expand it
                if (result.IsExpandable) {
                    const parentVariable: IDebugVariable = {
                        variables: [result],
                        evaluateChildren: true
                    };
                    this._variableHandles.create(parentVariable);
                }
                response.body = {
                    value: result.StringRepr
                };
                this.sendResponse(response);
            });
        }).catch(error => this.sendErrorResponse(response, 2000, error));
    }
}

LoggingDebugSession.run(PythonDebugger);
