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
import { traceInfo } from '../../common/logger';
import { noop } from '../../common/utils/misc';
import { Identifiers } from '../constants';
import { InteractiveWindowMessages, IRunByLine } from '../interactive-common/interactiveWindowTypes';
import { ICell, IInteractiveWindowListener, IJupyterDebugService } from '../types';

// tslint:disable: no-any
/**
 * Native editor listener that responds to run by line commands from the UI and uses
 * those commands to control a debug client.
 */
@injectable()
export class NativeEditorRunByLineListener
    implements IInteractiveWindowListener, DebugAdapterTrackerFactory, DebugAdapterTracker {
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        payload: any;
    }>();
    private currentCellBeingRun: ICell | undefined;

    constructor(
        @inject(IJupyterDebugService)
        @named(Identifiers.RUN_BY_LINE_DEBUGSERVICE)
        private debugService: IJupyterDebugService
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
        if (message.type === 'event' && message.event === 'stopped') {
            // We've stopped at breakpoint. Get the top most stack frame to figure out our IP
            this.handleBreakEvent().ignoreErrors();
        } else if (message.type === 'event' && (message.command === 'next' || message.command === 'continue')) {
            this.handleContinueEvent().ignoreErrors();
        }
    }

    public onMessage(message: string, payload?: any): void {
        switch (message) {
            case InteractiveWindowMessages.Step:
                this.handleStep().ignoreErrors();
                break;

            case InteractiveWindowMessages.Continue:
                this.handleContinue().ignoreErrors();
                break;

            case InteractiveWindowMessages.RunByLine:
                this.saveCell(payload);
                break;

            default:
                break;
        }
    }
    public dispose(): void | undefined {
        noop();
    }

    private saveCell(runByLine: IRunByLine) {
        this.currentCellBeingRun = { ...runByLine.cell };
    }

    private async handleBreakEvent() {
        // First get the stack
        const frames = await this.debugService.getStack();

        // Then force a variable refresh
        await this.debugService.requestVariables();

        // If we got frames, tell the UI
        if (frames && frames.length > 0) {
            traceInfo(`Broke into ${frames[0].source?.path}:${frames[0].line}`);
            // Tell the UI to move to a new location
            this.postEmitter.fire({
                message: InteractiveWindowMessages.ShowBreak,
                payload: { frames, cell: this.currentCellBeingRun }
            });
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
}
