// tslint:disable:interface-name member-access no-single-line-block-comment no-any no-stateless-class member-ordering prefer-method-signature no-unnecessary-class

'use strict';
import { ChildProcess } from 'child_process';
import * as net from 'net';
import { OutputEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebuggerPerformanceTelemetry, DebuggerTelemetry } from '../../telemetry/types';
import { DebuggerTypeName } from './constants';

export type DebuggerType = typeof DebuggerTypeName;
export class TelemetryEvent extends OutputEvent {
    body!: {
        /** The category of output (such as: 'console', 'stdout', 'stderr', 'telemetry'). If not specified, 'console' is assumed. */
        category: string;
        /** The output to report. */
        output: string;
        /** Optional data to report. For the 'telemetry' category the data will be sent to telemetry, for the other categories the data is shown in JSON format. */
        data?: any;
    };
    constructor(output: string, data?: DebuggerTelemetry | DebuggerPerformanceTelemetry) {
        super(output, 'telemetry');
        if (data) {
            this.body.data = data;
        }
    }
}
export const DjangoApp = 'DJANGO';
export enum DebugFlags {
    None = 0,
    IgnoreCommandBursts = 1
}

export enum DebugOptions {
    WaitOnAbnormalExit = 'WaitOnAbnormalExit',
    WaitOnNormalExit = 'WaitOnNormalExit',
    RedirectOutput = 'RedirectOutput',
    Django = 'Django',
    Jinja = 'Jinja',
    DebugStdLib = 'DebugStdLib',
    BreakOnSystemExitZero = 'BreakOnSystemExitZero',
    Sudo = 'Sudo',
    Pyramid = 'Pyramid',
    FixFilePathCase = 'FixFilePathCase',
    WindowsClient = 'WindowsClient',
    UnixClient = 'UnixClient',
    StopOnEntry = 'StopOnEntry'
}

export interface ExceptionHandling {
    ignore: string[];
    always: string[];
    unhandled: string[];
}

export interface AdditionalLaunchDebugOptions {
    redirectOutput?: boolean;
    django?: boolean;
    gevent?: boolean;
    jinja?: boolean;
    debugStdLib?: boolean;
    sudo?: boolean;
    pyramid?: boolean;
    stopOnEntry?: boolean;
}

export interface AdditionalAttachDebugOptions {
    redirectOutput?: boolean;
    django?: boolean;
    gevent?: boolean;
    jinja?: boolean;
    debugStdLib?: boolean;
}

export interface BaseLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    type?: typeof DebuggerTypeName;
    /** An absolute path to the program to debug. */
    module?: string;
    program?: string;
    pythonPath: string;
    /** Automatically stop target after launch. If not specified, target does not stop. */
    stopOnEntry?: boolean;
    args: string[];
    cwd?: string;
    debugOptions?: DebugOptions[];
    env?: Object;
    envFile: string;
    console?: 'none' | 'integratedTerminal' | 'externalTerminal';
    port?: number;
    host?: string;
    logToFile?: boolean;
}

export interface LaunchRequestArgumentsV1 extends BaseLaunchRequestArguments {
    exceptionHandling?: ExceptionHandling;
}

export interface LaunchRequestArguments extends BaseLaunchRequestArguments, AdditionalLaunchDebugOptions {
}

export interface BaseAttachRequestArguments extends DebugProtocol.AttachRequestArguments {
    type?: typeof DebuggerTypeName;
    /** An absolute path to local directory with source. */
    port?: number;
    host?: string;
    logToFile?: boolean;
    debugOptions?: DebugOptions[];
}
export interface AttachRequestArgumentsV1 extends BaseAttachRequestArguments {
    secret?: string;
    localRoot: string;
    remoteRoot: string;
}

export interface AttachRequestArguments extends BaseAttachRequestArguments, AdditionalAttachDebugOptions {
    localRoot?: string;
    remoteRoot?: string;
    pathMappings?: { localRoot: string; remoteRoot: string }[];
}
export interface IDebugServer {
    port: number;
    host?: string;
}

export enum FrameKind {
    None,
    Python,
    Django
}

export enum enum_EXCEPTION_STATE {
    BREAK_MODE_NEVER = 0,
    BREAK_MODE_ALWAYS = 1,
    BREAK_MODE_UNHANDLED = 32
}
export enum PythonLanguageVersion {
    Is2,
    Is3
}

export enum PythonEvaluationResultReprKind {
    Normal,
    Raw,
    RawLen
}

export enum PythonEvaluationResultFlags {
    None = 0,
    Expandable = 1,
    MethodCall = 2,
    SideEffects = 4,
    Raw = 8,
    HasRawRepr = 16
}

export interface IPythonProcess extends NodeJS.EventEmitter {
    Connect(buffer: Buffer, socket: net.Socket, isRemoteProcess: boolean): boolean;
    HandleIncomingData(buffer: Buffer);
    attach(proc: ChildProcess): void;
    Detach();
    Kill();
    SendStepInto(threadId: number);
    SendStepOver(threadId: number);
    SendStepOut(threadId: number);
    SendResumeThread(threadId: number);
    AutoResumeThread(threadId: number);
    SendClearStepping(threadId: number);
    ExecuteText(text: string, reprKind: any, stackFrame: IPythonStackFrame): Promise<IPythonEvaluationResult>;
    EnumChildren(text: string, stackFrame: IPythonStackFrame, timeout: number): Promise<IPythonEvaluationResult[]>;
    SetLineNumber(pythonStackFrame: IPythonStackFrame, lineNo: number);
    Threads: Map<number, IPythonThread>;
    ProgramDirectory: string;
    PendingChildEnumCommands: Map<number, IChildEnumCommand>;
    PendingExecuteCommands: Map<number, IExecutionCommand>;
    ProcessPendingExecuteCommands();
}

export interface IPythonEvaluationResult {
    Flags: PythonEvaluationResultFlags;
    IsExpandable: boolean;
    StringRepr: string;
    HexRepr: string;
    TypeName: string;
    Length: number;
    ExceptionText?: string;
    Expression: string;
    ChildName: string;
    Process?: IPythonProcess;
    Frame: IPythonStackFrame;
}

export interface IPythonModule {
    ModuleId: number;
    Name: string;
    Filename: string;
}

export interface IPythonThread {
    IsWorkerThread: boolean;
    Process: IPythonProcess;
    Name: string;
    Id: number;
    Int32Id: number;
    Frames: IPythonStackFrame[];
}

export interface IPythonStackFrame {
    StartLine: number;
    EndLine: number;
    Thread: IPythonThread;
    LineNo: number;
    FunctionName: string;
    FileName: string;
    Kind: FrameKind;
    FrameId: number;
    Locals: IPythonEvaluationResult[];
    Parameters: IPythonEvaluationResult[];
}

export interface IDjangoStackFrame extends IPythonStackFrame {
    SourceFile: string;
    SourceLine: number;
}

export interface IStepCommand {
    PromiseResolve: (pyThread: IPythonThread) => void;
    PythonThreadId: number;
}

export interface IBreakpointCommand {
    Id: number;
    PromiseResolve: () => void;
    PromiseReject: () => void;
}
export interface IChildEnumCommand {
    Id: number;
    Frame: IPythonStackFrame;
    PromiseResolve: (value: IPythonEvaluationResult[]) => void;
    PromiseReject: () => void;
}
export interface IExecutionCommand {
    Id: number;
    Text: string;
    Frame: IPythonStackFrame;
    PromiseResolve: (value: IPythonEvaluationResult) => void;
    PromiseReject: (error: string) => void;
    ReprKind: PythonEvaluationResultReprKind;
}
// Must be in sync with BREAKPOINT_CONDITION_* constants in visualstudio_py_debugger.py.
export enum PythonBreakpointConditionKind {
    Always = 0,
    WhenTrue = 1,
    WhenChanged = 2
}

// Must be in sync with BREAKPOINT_PASS_COUNT_* constants in visualstudio_py_debugger.py.
export enum PythonBreakpointPassCountKind {
    Always = 0,
    Every = 1,
    WhenEqual = 2,
    WhenEqualOrGreater = 3
}

export interface IPythonBreakpoint {
    IsDjangoBreakpoint?: boolean;
    Id: number;
    Filename: string;
    LineNo: number;
    ConditionKind: PythonBreakpointConditionKind;
    Condition: string;
    PassCountKind: PythonBreakpointPassCountKind;
    PassCount: number;
    Enabled: boolean;
}
export interface IPythonException {
    TypeName: string;
    Description: string;
}
