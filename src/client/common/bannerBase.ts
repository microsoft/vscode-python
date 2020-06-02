// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IPersistentStateFactory, IPythonExtensionBanner } from '../common/types';

// Base class for a popup (banner) that proposes user to try out a new feature of
// the extension, and optionally enable that new feature if they choose to do so.
export abstract class BannerBase implements IPythonExtensionBanner {
    protected initialization = Promise.resolve();
    protected disabledInCurrentSession = false;

    constructor(private readonly settingName: string, protected readonly persistentState: IPersistentStateFactory) {
        this.initialization = this.initialize();
    }

    public async isEnabled(): Promise<boolean> {
        await this.initialization;
        return this.getStateValue(this.settingName, true);
    }

    public async shouldShowBanner(): Promise<boolean> {
        await this.initialization;
        if (this.disabledInCurrentSession) {
            return false;
        }
        return this.isEnabled();
    }

    public async disable(): Promise<void> {
        return this.setStateValue(this.settingName, false);
    }

    public async showBanner(): Promise<void> {
        return Promise.resolve();
    }

    protected initialize(): Promise<void> {
        return Promise.resolve();
    }

    protected getStateValue(name: string, defaultValue: boolean): boolean {
        return this.persistentState.createGlobalPersistentState<boolean>(name, defaultValue).value;
    }
    protected async setStateValue(name: string, value: boolean): Promise<void> {
        return this.persistentState.createGlobalPersistentState<boolean>(name, value).updateValue(value);
    }
}
