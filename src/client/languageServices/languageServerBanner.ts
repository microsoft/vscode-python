// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { IApplicationEnvironment, IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IBrowserService, IDismissableSurveyBanner, IPersistentStateFactory } from '../common/types';
import { IServiceContainer } from '../ioc/types';

export enum PythonLangServerPersistentStateKeys {
    ShowLanguageServiceBanner = 'ShowLanguageServiceBanner',
    PythonLSLaunchCounter = 'PythonLSLaunchCounter',
    PythonLSLaunchThresholdCounter = 'PythonLSLaunchThresholdCounter'
}

@injectable()
export class LanguageServerBanner implements IDismissableSurveyBanner {
    private initialized?: boolean;
    private disabledInCurrentSession?: boolean;
    public get enabled(): boolean {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        return factory.createGlobalPersistentState<boolean>(PythonLangServerPersistentStateKeys.ShowLanguageServiceBanner, true).value;
    }
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) { }
    public initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        // Don't even bother adding handlers if banner has been turned off.
        if (!this.enabled) {
            return;
        }

        const lsExtService = IExtensionActivatorService = this.serviceContainer.get<IExtensionActivationService>(IExtensionActivatorService);
    }

    public async showBanner(): Promise<void> {
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        const yes = 'Yes, take survey now';
        const no = 'No, thanks';
        const response = await appShell.showInformationMessage('Can you please take 2 minutes to tell us how the Experimental Debugger is working for you?', yes, no);
        switch (response) {
            case yes:
                {
                    await this.launchSurvey();
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
    public async shouldShowBanner(): Promise<boolean> {
        if (!this.enabled || this.disabledInCurrentSession) {
            return false;
        }
        const [threshold, launchCounter] = await Promise.all([this.getPythonLSLaunchThresholdCounter(), this.getPythonLSLaunchCounter()]);
        return launchCounter >= threshold;
    }

    public async disable(): Promise<void> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        await factory.createGlobalPersistentState<boolean>(PythonLangServerPersistentStateKeys.ShowLanguageServiceBanner, false).updateValue(false);
    }

    public async launchSurvey(): Promise<void> {
        const launchCounter = await this.getPythonLSLaunchCounter();
        const browser = this.serviceContainer.get<IBrowserService>(IBrowserService);
        browser.launch(`https://www.research.net/r/LJZV9BZ?n=${launchCounter}`);
    }
    private async incrementPythonLanguageServiceLaunchCounter(): Promise<void> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const state = factory.createGlobalPersistentState<number>(PythonLangServerPersistentStateKeys.PythonLSLaunchCounter, 0);
        await state.updateValue(state.value + 1);
    }
    private async getPythonLSLaunchCounter(): Promise<number> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const state = factory.createGlobalPersistentState<number>(PythonLangServerPersistentStateKeys.PythonLSLaunchCounter, 0);
        return state.value;
    }
    private async getPythonLSLaunchThresholdCounter(): Promise<number> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const state = factory.createGlobalPersistentState<number | undefined>(PythonLangServerPersistentStateKeys.PythonLSLaunchThresholdCounter, undefined);
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

    private async onInitializedPythonLanguageService(): Promise<void> {
        if (!this.enabled) {
            return;
        }
        await this.incrementPythonLanguageServiceLaunchCounter();
        const show = await this.shouldShowBanner();
        if (!show) {
            return;
        }

        await this.showBanner();
    }
}
