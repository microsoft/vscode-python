// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable, named } from 'inversify';
import {
    DebugAdapterTracker,
    DebugAdapterTrackerFactory,
    DebugSession,
    Event,
    EventEmitter,
    ProviderResult
} from 'vscode';

import { PYTHON_LANGUAGE } from '../../common/constants';
import { Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { Identifiers } from '../constants';
import { getCellHashProvider } from '../editor-integration/cellhashprovider';
import { INotebookIdentity, InteractiveWindowMessages, IRunByLine } from '../interactive-common/interactiveWindowTypes';
import {
    IInteractiveWindowListener,
    IJupyterDebugger,
    IJupyterDebugService,
    INotebook,
    INotebookProvider
} from '../types';

// tslint:disable: no-any
@injectable()
export class NativeEditorDebuggerListener
    implements IInteractiveWindowListener, DebugAdapterTrackerFactory, DebugAdapterTracker {
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        payload: any;
    }>();
    private nativeIdentity: Resource;
    constructor(
        @inject(IJupyterDebugService)
        @named(Identifiers.RUN_BY_LINE_DEBUGSERVICE)
        private debugService: IJupyterDebugService,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IJupyterDebugger) private jupyterDebugger: IJupyterDebugger
    ) {
        debugService.registerDebugAdapterTrackerFactory(PYTHON_LANGUAGE, this);
    }

    public createDebugAdapterTracker(_session: DebugSession): ProviderResult<DebugAdapterTracker> {
        return this;
    }

    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    public onDidSendMessage?(message: any): void {
        if (message.type === 'event' && message.command === 'stop') {
            // We've stopped at breakpoint. Get the top most stack frame to figure out our IP
            this.handleBreakEvent().ignoreErrors();
        } else if (message.type === 'event' && (message.command === 'next' || message.command === 'continue')) {
            this.handleContinueEvent().ignoreErrors();
        }
    }

    public onMessage(message: string, payload?: any): void {
        switch (message) {
            case InteractiveWindowMessages.RunByLine:
                this.handleRunByLine(payload).ignoreErrors();
                break;

            case InteractiveWindowMessages.NotebookIdentity:
                this.setIdentity(payload);
                break;

            case InteractiveWindowMessages.Step:
                this.handleStep().ignoreErrors();
                break;

            case InteractiveWindowMessages.Continue:
                this.handleContinue().ignoreErrors();
                break;

            default:
                break;
        }
    }
    public dispose(): void | undefined {
        noop();
    }

    private async handleBreakEvent() {
        // First get the stack
        const frames = await this.debugService.getStack();
        if (frames && frames.length > 0) {
            // Tell the UI to move to a new location
            this.postEmitter.fire({ message: InteractiveWindowMessages.ShowBreak, payload: frames });
        }
    }

    private async handleStep() {
        // User issued a step command.
        return this.debugService.step();
    }

    private async handleContinue() {
        // User issued a continue command
        return this.debugService.continue();
    }

    private async handleContinueEvent() {
        // Tell the ui to erase the current IP
        this.postEmitter.fire({ message: InteractiveWindowMessages.ShowContinue, payload: undefined });
    }

    private async handleRunByLine(runByLineArgs: IRunByLine) {
        const notebook = await this.getNotebook();
        if (notebook) {
            const hashProvider = getCellHashProvider(notebook);
            if (hashProvider) {
                const hashFileName = hashProvider.generateHashFileName(
                    runByLineArgs.cell,
                    runByLineArgs.expectedExecutionCount
                );
                return this.jupyterDebugger.startRunByLine(notebook, hashFileName);
            }
        }
    }

    private setIdentity(identity: INotebookIdentity) {
        if (identity.type === 'native') {
            this.nativeIdentity = identity.resource;
        }
    }

    private async getNotebook(): Promise<INotebook | undefined> {
        if (this.nativeIdentity) {
            return this.notebookProvider.getOrCreateNotebook({ getOnly: true, identity: this.nativeIdentity });
        }
    }
}
