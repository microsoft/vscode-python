// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable } from 'vscode';
import { IApplicationShell, IDebugService } from '../../common/application/types';
import '../../common/extensions';
import { traceError } from '../../common/logger';
import { IBrowserService, IDisposableRegistry, IPersistentStateFactory, IRandom } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { DebuggerTypeName } from '../constants';
import { IDebuggerBanner } from './types';

const SAMPLE_SIZE_PER_HUNDRED = 10;

export enum PersistentStateKeys {
    ShowBanner = 'ShowBanner',
    DebuggerLaunchCounter = 'DebuggerLaunchCounter',
    DebuggerLaunchThresholdCounter = 'DebuggerLaunchThresholdCounter',
    UserSelected = 'DebuggerUserSelected'
}

@injectable()
export class DebuggerBanner implements IDebuggerBanner {
    private initialized?: boolean;
    private disabledInCurrentSession?: boolean;
    private userSelected?: boolean;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {}

    public initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        // Don't even bother adding handlers if banner has been turned off.
        if (!this.isEnabled()) {
            return;
        }

        this.addCallback();
    }

    // "enabled" state

    public isEnabled(): boolean {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const key = PersistentStateKeys.ShowBanner;
        const state = factory.createGlobalPersistentState<boolean>(key, true);
        return state.value;
    }

    public async disable(): Promise<void> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const key = PersistentStateKeys.ShowBanner;
        const state = factory.createGlobalPersistentState<boolean>(key, false);
        await state.updateValue(false);
    }

    // showing banner

    public async shouldShow(): Promise<boolean> {
        if (!this.isEnabled() || this.disabledInCurrentSession) {
            return false;
        }
        if (!(await this.passedThreshold())) {
            return false;
        }
        return this.isUserSelected();
    }

    public async show(): Promise<void> {
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        const msg = 'Can you please take 2 minutes to tell us how the debugger is working for you?';
        const yes = 'Yes, take survey now';
        const no = 'No thanks';
        const later = 'Remind me later';
        const response = await appShell.showInformationMessage(msg, yes, no, later);
        switch (response) {
            case yes: {
                await this.action();
                await this.disable();
                break;
            }
            case no: {
                await this.disable();
                break;
            }
            default: {
                // Disable for the current session.
                this.disabledInCurrentSession = true;
            }
        }
    }

    private async action(): Promise<void> {
        const debuggerLaunchCounter = await this.getGetDebuggerLaunchCounter();
        const browser = this.serviceContainer.get<IBrowserService>(IBrowserService);
        browser.launch(`https://www.research.net/r/N7B25RV?n=${debuggerLaunchCounter}`);
    }

    // user selection

    private async isUserSelected(): Promise<boolean> {
        if (this.userSelected !== undefined) {
            return this.userSelected;
        }

        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const key = PersistentStateKeys.UserSelected;
        const state = factory.createGlobalPersistentState<boolean | undefined>(key, undefined);
        let selected = state.value;
        if (selected === undefined) {
            const runtime = this.serviceContainer.get<IRandom>(IRandom);
            const randomSample = runtime.getRandomInt(0, 100);
            selected = randomSample < SAMPLE_SIZE_PER_HUNDRED;
            state.updateValue(selected).ignoreErrors();
        }
        this.userSelected = selected;
        return selected;
    }

    // persistent counter

    private async passedThreshold(): Promise<boolean> {
        const [threshold, debuggerCounter] = await Promise.all([
            this.getDebuggerLaunchThresholdCounter(),
            this.getGetDebuggerLaunchCounter()
        ]);
        return debuggerCounter >= threshold;
    }

    private async incrementDebuggerLaunchCounter(): Promise<void> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const key = PersistentStateKeys.DebuggerLaunchCounter;
        const state = factory.createGlobalPersistentState<number>(key, 0);
        await state.updateValue(state.value + 1);
    }

    private async getGetDebuggerLaunchCounter(): Promise<number> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const key = PersistentStateKeys.DebuggerLaunchCounter;
        const state = factory.createGlobalPersistentState<number>(key, 0);
        return state.value;
    }

    private async getDebuggerLaunchThresholdCounter(): Promise<number> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const key = PersistentStateKeys.DebuggerLaunchThresholdCounter;
        const state = factory.createGlobalPersistentState<number | undefined>(key, undefined);
        if (state.value === undefined) {
            const runtime = this.serviceContainer.get<IRandom>(IRandom);
            const randomNumber = runtime.getRandomInt(1, 11);
            await state.updateValue(randomNumber);
        }
        return state.value!;
    }

    // debugger-specific functionality

    private addCallback() {
        const debuggerService = this.serviceContainer.get<IDebugService>(IDebugService);
        const disposable = debuggerService.onDidTerminateDebugSession(async e => {
            if (e.type === DebuggerTypeName) {
                await this.onDidTerminateDebugSession().catch(ex => traceError('Error in debugger Banner', ex));
            }
        });
        this.serviceContainer.get<Disposable[]>(IDisposableRegistry).push(disposable);
    }

    private async onDidTerminateDebugSession(): Promise<void> {
        if (!this.isEnabled()) {
            return;
        }
        await this.incrementDebuggerLaunchCounter();
        const show = await this.shouldShow();
        if (!show) {
            return;
        }

        await this.show();
    }
}
