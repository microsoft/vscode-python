// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { Disposable } from 'vscode';
import { IApplicationEnvironment, IApplicationShell, IDebugService } from '../common/application/types';
import '../common/extensions';
import { IBrowserService, IDisposableRegistry,
    ILogger, IPersistentStateFactory } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { DebuggerTypeName } from './Common/constants';
import { IDebuggerBanner } from './types';

export enum PersistentStateKeys {
    ShowBanner = 'ShowBanner',
    DebuggerLaunchCounter = 'DebuggerLaunchCounter',
    DebuggerLaunchThresholdCounter = 'DebuggerLaunchThresholdCounter'
}

@injectable()
export class DebuggerBanner implements IDebuggerBanner {
    private initialized?: boolean;
    private disabledInCurrentSession?: boolean;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) { }

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

    public async launchSurvey(): Promise<void> {
        return this.action();
    }

    // "enabled" state

    public isEnabled(): boolean {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        return factory.createGlobalPersistentState<boolean>(PersistentStateKeys.ShowBanner, true).value;
    }

    public async disable(): Promise<void> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        await factory.createGlobalPersistentState<boolean>(PersistentStateKeys.ShowBanner, false).updateValue(false);
    }

    // showing banner

    public async shouldShow(): Promise<boolean> {
        if (!this.isEnabled() || this.disabledInCurrentSession) {
            return false;
        }
        return this.passedThreshold();
    }

    public async show(): Promise<void> {
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        const yes = 'Yes, take survey now';
        const no = 'No thanks';
        const response = await appShell.showInformationMessage('Can you please take 2 minutes to tell us how the Debugger is working for you?', yes, no);
        switch (response) {
            case yes:
                {
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

    // persistent counter

    private async passedThreshold(): Promise<boolean> {
        const [threshold, debuggerCounter] = await Promise.all([this.getDebuggerLaunchThresholdCounter(), this.getGetDebuggerLaunchCounter()]);
        return debuggerCounter >= threshold;
    }

    private async incrementDebuggerLaunchCounter(): Promise<void> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const state = factory.createGlobalPersistentState<number>(PersistentStateKeys.DebuggerLaunchCounter, 0);
        await state.updateValue(state.value + 1);
    }

    private async getGetDebuggerLaunchCounter(): Promise<number> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const state = factory.createGlobalPersistentState<number>(PersistentStateKeys.DebuggerLaunchCounter, 0);
        return state.value;
    }

    private async getDebuggerLaunchThresholdCounter(): Promise<number> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const state = factory.createGlobalPersistentState<number | undefined>(PersistentStateKeys.DebuggerLaunchThresholdCounter, undefined);
        if (state.value === undefined) {
            const hexValue = parseInt(`0x${this.getRandomHex()}`, 16);
            const randomNumber = Math.floor((10 * hexValue) / 16) + 1;
            await state.updateValue(randomNumber);
        }
        return state.value!;
    }

    private getRandomHex() {
        const appEnv = this.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
        const lastHexValue = appEnv.machineId.slice(-1);
        const num = parseInt(`0x${lastHexValue}`, 16);
        return isNaN(num) ? crypto.randomBytes(1).toString('hex').slice(-1) : lastHexValue;
    }

    // debugger-specific functionality

    private addCallback() {
        const debuggerService = this.serviceContainer.get<IDebugService>(IDebugService);
        const disposable = debuggerService.onDidTerminateDebugSession(async e => {
            if (e.type === DebuggerTypeName) {
                const logger = this.serviceContainer.get<ILogger>(ILogger);
                await this.onDidTerminateDebugSession()
                    .catch(ex => logger.logError('Error in debugger Banner', ex));
            }
        });
        this.serviceContainer.get<Disposable[]>(IDisposableRegistry).push(disposable);
    }

    private async action(): Promise<void> {
        const debuggerLaunchCounter = await this.getGetDebuggerLaunchCounter();
        const browser = this.serviceContainer.get<IBrowserService>(IBrowserService);
        browser.launch(`https://www.research.net/r/N7B25RV?n=${debuggerLaunchCounter}`);
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
