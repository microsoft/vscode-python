// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { Breakpoint, BreakpointsChangeEvent, debug, DebugConfiguration, DebugConsole, DebugSession, DebugSessionCustomEvent, Disposable, Event, WorkspaceFolder } from 'vscode';
import { IDebugService } from './types';

@injectable()
export class DebugService implements IDebugService {
    public static instance = new DebugService();
    public get activeDebugConsole(): DebugConsole {
        return debug.activeDebugConsole;
    }
    public get activeDebugSession(): DebugSession | undefined {
        return debug.activeDebugSession;
    }
    public get breakpoints(): Breakpoint[] {
        return debug.breakpoints;
    }
    public get onDidChangeActiveDebugSession(): Event<DebugSession | undefined> {
        return debug.onDidChangeActiveDebugSession;
    }
    public get onDidStartDebugSession(): Event<DebugSession> {
        return debug.onDidStartDebugSession;
    }
    public get onDidReceiveDebugSessionCustomEvent(): Event<DebugSessionCustomEvent> {
        return debug.onDidReceiveDebugSessionCustomEvent;
    }
    public get onDidTerminateDebugSession(): Event<DebugSession> {
        return debug.onDidTerminateDebugSession;
    }
    public get onDidChangeBreakpoints(): Event<BreakpointsChangeEvent> {
        return debug.onDidChangeBreakpoints;
    }
    // tslint:disable-next-line:no-any
    public registerDebugConfigurationProvider(debugType: string, provider: any): Disposable {
        return debug.registerDebugConfigurationProvider(debugType, provider);
    }
    public startDebugging(folder: WorkspaceFolder, nameOrConfiguration: string | DebugConfiguration): Thenable<boolean> {
        return debug.startDebugging(folder, nameOrConfiguration);
    }
    public addBreakpoints(breakpoints: Breakpoint[]): void {
        debug.addBreakpoints(breakpoints);
    }
    public removeBreakpoints(breakpoints: Breakpoint[]): void {
        debug.removeBreakpoints(breakpoints);
    }
}
