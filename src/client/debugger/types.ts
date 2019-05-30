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
    ShowReturnValue = 'ShowReturnValue',
    SubProcess = 'Multiprocess'
}

interface ICommonDebugArguments {
    redirectOutput?: boolean;
    django?: boolean;
    gevent?: boolean;
    jinja?: boolean;
    debugStdLib?: boolean;
    justMyCode?: boolean;
    logToFile?: boolean;
    debugOptions?: DebugOptions[];
    port?: number;
    host?: string;
    // Show return values of functions while stepping.
    showReturnValue?: boolean;
    subProcess?: boolean;
}
export interface IKnownAttachDebugArguments extends ICommonDebugArguments {
    workspaceFolder?: string;
    // An absolute path to local directory with source.
    localRoot?: string;
    remoteRoot?: string;
    pathMappings?: { localRoot: string; remoteRoot: string }[];
    customDebugger?: boolean;
}

export interface IKnownLaunchRequestArguments extends ICommonDebugArguments {
    sudo?: boolean;
    pyramid?: boolean;
    workspaceFolder?: string;
    // An absolute path to the program to debug.
    module?: string;
    program?: string;
    pythonPath: string;
    // Automatically stop target after launch. If not specified, target does not stop.
    stopOnEntry?: boolean;
    args: string[];
    cwd?: string;
    debugOptions?: DebugOptions[];
    env?: Record<string, string | undefined>;
    envFile: string;
    console?: ConsoleType;
}
// tslint:disable-next-line:interface-name
export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments, IKnownLaunchRequestArguments, DebugConfiguration {
    type: typeof DebuggerTypeName;
}

// tslint:disable-next-line:interface-name
export interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments, IKnownAttachDebugArguments, DebugConfiguration {
    type: typeof DebuggerTypeName;
}

// tslint:disable-next-line:interface-name
export interface DebugConfigurationArguments extends LaunchRequestArguments, AttachRequestArguments { }

export type ConsoleType = 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
