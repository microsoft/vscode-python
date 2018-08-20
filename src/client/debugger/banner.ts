// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { IApplicationEnvironment, IApplicationShell, IDebugService } from '../common/application/types';
import '../common/extensions';
import { IBrowserService, IDisposableRegistry,
    ILogger, IPersistentState, IPersistentStateFactory } from '../common/types';
import { getRandomBetween } from '../common/utils';
import { IServiceContainer } from '../ioc/types';
import { DebuggerTypeName } from './Common/constants';
import { IDebuggerBanner } from './types';

export enum PersistentStateKeys {
    ShowBanner = 'ShowBanner',
    DebuggerUserSelected = 'DebuggerUserSelected',
    DebuggerLaunchCounter = 'DebuggerLaunchCounter',
    DebuggerLaunchThresholdCounter = 'DebuggerLaunchThresholdCounter'
}

type IsUserSelectedFunc = (state: IPersistentState<boolean | undefined>) => boolean;
type RandIntFunc = (min: number, max: number) => number;

const sampleSizePerHundred: number = 10;  // 10%

export function isUserSelected(state: IPersistentState<boolean | undefined>, randInt: RandIntFunc = getRandomBetween): boolean {
    let selected = state.value;
    if (selected === undefined) {
        const randomSample: number = randInt(0, 100);
        selected = randomSample < sampleSizePerHundred;
        state.updateValue(selected).ignoreErrors();
    }
    return selected;
}

@injectable()
export class DebuggerBanner implements IDebuggerBanner {
    private disabledInCurrentSession?: boolean;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        // The following is only used during testing and will not be
        // passed in normally (hence the underscore).
        _isUserSelected: IsUserSelectedFunc = isUserSelected)
    {
        if (!this.enabled) {
            return;
        }

        // Only show the banner to a subset of users.  (see GH-2300)
        // In order to avoid selecting the user *every* time they start
        // the extension, we store their selection in the persistence
        // layer.
        const persist = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const key = PersistentStateKeys.DebuggerUserSelected;
        const state = persist.createGlobalPersistentState<boolean | undefined>(key, undefined);
        if (!_isUserSelected(state)) {
            this.disable().ignoreErrors();
        }
    }

    public async launchSurvey(): Promise<void> {
        return this._action();
    }

    // "enabled" state

    public get enabled(): boolean {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        return factory.createGlobalPersistentState<boolean>(PersistentStateKeys.ShowBanner, true).value;
    }

    public async disable(): Promise<void> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        await factory.createGlobalPersistentState<boolean>(PersistentStateKeys.ShowBanner, false).updateValue(false);
    }

    // showing banner

    public async shouldShowBanner(): Promise<boolean> {
        if (!this.enabled || this.disabledInCurrentSession) {
            return false;
        }
        return this.passedThreshold();
    }

    public async showBanner(): Promise<void> {
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        const yes = 'Yes, take survey now';
        const no = 'No thanks';
        const response = await appShell.showInformationMessage('Can you please take 2 minutes to tell us how the Debugger is working for you?', yes, no);
        switch (response) {
            case yes:
                {
                    await this._action();
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

    private async _action(): Promise<void> {
        const debuggerLaunchCounter = await this.getGetDebuggerLaunchCounter();
        const browser = this.serviceContainer.get<IBrowserService>(IBrowserService);
        browser.launch(`https://www.research.net/r/N7B25RV?n=${debuggerLaunchCounter}`);
    }

    // tslint:disable-next-line:member-ordering
    public async onDidTerminateDebugSession(): Promise<void> {
        if (!this.enabled) {
            return;
        }
        await this.incrementDebuggerLaunchCounter();
        const show = await this.shouldShowBanner();
        if (!show) {
            return;
        }

        await this.showBanner();
    }
}

export function injectDebuggerBanner(
    banner: IDebuggerBanner,
    debuggerService: IDebugService,
    disposables: IDisposableRegistry,
    logger: ILogger
) {
    // Don't even bother adding handlers if banner has been turned off.
    if (!banner.enabled) {
        return;
    }

    const disposable = debuggerService.onDidTerminateDebugSession(async e => {
        if (e.type === DebuggerTypeName) {
            await banner.onDidTerminateDebugSession()
                .catch(ex => logger.logError('Error in debugger Banner', ex));
        }
    });
    disposables.push(disposable);
}
