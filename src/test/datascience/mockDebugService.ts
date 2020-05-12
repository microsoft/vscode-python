// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable, named } from 'inversify';
import {
    Breakpoint,
    BreakpointsChangeEvent,
    DebugAdapterDescriptorFactory,
    DebugAdapterTrackerFactory,
    DebugConfiguration,
    DebugConfigurationProvider,
    DebugConsole,
    DebugSession,
    DebugSessionCustomEvent,
    Disposable,
    Event,
    WorkspaceFolder
} from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { Identifiers } from '../../client/datascience/constants';
import { IJupyterDebugService } from '../../client/datascience/types';

@injectable()
export class MockDebuggerService implements IJupyterDebugService {
    constructor(
        @inject(IJupyterDebugService)
        @named(Identifiers.RUN_BY_LINE_DEBUGSERVICE)
        private jupyterDebugService: IJupyterDebugService
    ) {}
    public get activeDebugSession(): DebugSession | undefined {
        return this.activeService.activeDebugSession;
    }

    public get activeDebugConsole(): DebugConsole {
        return this.activeService.activeDebugConsole;
    }
    public get breakpoints(): Breakpoint[] {
        return this.activeService.breakpoints;
    }
    public get onDidChangeActiveDebugSession(): Event<DebugSession | undefined> {
        return this.activeService.onDidChangeActiveDebugSession;
    }
    public get onDidStartDebugSession(): Event<DebugSession> {
        return this.activeService.onDidStartDebugSession;
    }
    public get onDidReceiveDebugSessionCustomEvent(): Event<DebugSessionCustomEvent> {
        return this.activeService.onDidReceiveDebugSessionCustomEvent;
    }
    public get onDidTerminateDebugSession(): Event<DebugSession> {
        return this.activeService.onDidTerminateDebugSession;
    }
    public get onDidChangeBreakpoints(): Event<BreakpointsChangeEvent> {
        return this.onDidChangeBreakpoints;
    }
    public get onBreakpointHit(): Event<void> {
        return this.activeService.onBreakpointHit;
    }
    public startRunByLine(config: DebugConfiguration): Thenable<boolean> {
        return this.jupyterDebugService.startRunByLine(config);
    }
    public registerDebugConfigurationProvider(debugType: string, provider: DebugConfigurationProvider): Disposable {
        return this.jupyterDebugService.registerDebugConfigurationProvider(debugType, provider);
    }
    public registerDebugAdapterDescriptorFactory(
        debugType: string,
        factory: DebugAdapterDescriptorFactory
    ): Disposable {
        return this.jupyterDebugService.registerDebugAdapterDescriptorFactory(debugType, factory);
    }
    public registerDebugAdapterTrackerFactory(debugType: string, factory: DebugAdapterTrackerFactory): Disposable {
        return this.jupyterDebugService.registerDebugAdapterTrackerFactory(debugType, factory);
    }
    public startDebugging(
        folder: WorkspaceFolder | undefined,
        nameOrConfiguration: string | DebugConfiguration,
        parentSession?: DebugSession | undefined
    ): Thenable<boolean> {
        return this.activeService.startDebugging(folder, nameOrConfiguration, parentSession);
    }
    public addBreakpoints(breakpoints: Breakpoint[]): void {
        return this.activeService.addBreakpoints(breakpoints);
    }
    public removeBreakpoints(breakpoints: Breakpoint[]): void {
        return this.activeService.removeBreakpoints(breakpoints);
    }
    public getStack(): Promise<DebugProtocol.StackFrame[]> {
        return this.activeService.getStack();
    }
    public step(): Promise<void> {
        return this.activeService.step();
    }
    public continue(): Promise<void> {
        return this.activeService.continue();
    }
    public requestVariables(): Promise<void> {
        return this.activeService.requestVariables();
    }
    public stop(): void {
        return this.activeService.stop();
    }
    private get activeService(): IJupyterDebugService {
        return this.jupyterDebugService;
    }
}
