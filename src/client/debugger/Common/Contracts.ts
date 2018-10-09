// tslint:disable:interface-name member-access no-single-line-block-comment no-any no-stateless-class member-ordering prefer-method-signature no-unnecessary-class

'use strict';
import { DebugConfiguration } from 'vscode';
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
export enum DebugOptions {
    RedirectOutput = 'RedirectOutput',
    Django = 'Django',
    Jinja = 'Jinja',
    DebugStdLib = 'DebugStdLib',
    Sudo = 'Sudo',
    Pyramid = 'Pyramid',
    FixFilePathCase = 'FixFilePathCase',
    WindowsClient = 'WindowsClient',
    UnixClient = 'UnixClient',
    StopOnEntry = 'StopOnEntry'
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

export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments, AdditionalLaunchDebugOptions, DebugConfiguration {
    type: typeof DebuggerTypeName;
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

export interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments, AdditionalAttachDebugOptions, DebugConfiguration {
    type: typeof DebuggerTypeName;
    /** An absolute path to local directory with source. */
    port?: number;
    host?: string;
    logToFile?: boolean;
    debugOptions?: DebugOptions[];
    localRoot?: string;
    remoteRoot?: string;
    pathMappings?: { localRoot: string; remoteRoot: string }[];
}

export interface IDebugServer {
    port: number;
    host?: string;
}
