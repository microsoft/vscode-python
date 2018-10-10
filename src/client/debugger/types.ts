// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugConfiguration } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebuggerTypeName } from './constants';

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
    StopOnEntry = 'StopOnEntry',
    ShowReturnValue = 'ShowReturnValue'
}

// tslint:disable-next-line:interface-name
interface AdditionalLaunchDebugOptions {
    redirectOutput?: boolean;
    django?: boolean;
    gevent?: boolean;
    jinja?: boolean;
    debugStdLib?: boolean;
    sudo?: boolean;
    pyramid?: boolean;
    stopOnEntry?: boolean;
    showReturnValue?: boolean;
}

// tslint:disable-next-line:interface-name
interface AdditionalAttachDebugOptions {
    redirectOutput?: boolean;
    django?: boolean;
    gevent?: boolean;
    jinja?: boolean;
    debugStdLib?: boolean;
}

// tslint:disable-next-line:interface-name
export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments, AdditionalLaunchDebugOptions, DebugConfiguration {
    type: typeof DebuggerTypeName;
    // An absolute path to the program to debug.
    module?: string;
    program?: string;
    pythonPath: string;
    // Automatically stop target after launch. If not specified, target does not stop.
    stopOnEntry?: boolean;
    /** Show return values of functions while stepping. */
    showReturnValue?: boolean;
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

// tslint:disable-next-line:interface-name
export interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments, AdditionalAttachDebugOptions, DebugConfiguration {
    type: typeof DebuggerTypeName;
    // An absolute path to local directory with source.
    port?: number;
    host?: string;
    logToFile?: boolean;
    debugOptions?: DebugOptions[];
    localRoot?: string;
    remoteRoot?: string;
    pathMappings?: { localRoot: string; remoteRoot: string }[];
}
