// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
import { StopWatch } from '../common/utils/stopWatch';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { getEnvPath } from './base/info/env';
import {
    GetRefreshEnvironmentsOptions,
    IDiscoveryAPI,
    ProgressNotificationEvent,
    PythonLocatorQuery,
} from './base/locator';

export type GetLocatorFunc = () => Promise<IDiscoveryAPI>;

/**
 * The public API for the Python environments component.
 *
 * Note that this is composed of sub-components.
 */
class PythonEnvironments implements IDiscoveryAPI {
    private locator!: IDiscoveryAPI;

    constructor(
        // These are factories for the sub-components the full component is composed of:
        private readonly getLocator: GetLocatorFunc,
    ) {}

    public async activate(): Promise<void> {
        this.locator = await this.getLocator();
    }

    public get onProgress(): Event<ProgressNotificationEvent> {
        return this.locator.onProgress;
    }

    public getRefreshPromise(options?: GetRefreshEnvironmentsOptions) {
        return this.locator.getRefreshPromise(options);
    }

    public get onChanged() {
        return this.locator.onChanged;
    }

    public getEnvs(query?: PythonLocatorQuery) {
        return this.locator.getEnvs(query);
    }

    public async resolveEnv(env: string) {
        return this.locator.resolveEnv(env);
    }

    public async triggerRefresh(query?: PythonLocatorQuery, trigger?: 'auto' | 'ui') {
        const stopWatch = new StopWatch();
        await this.locator.triggerRefresh(query);
        if (!query) {
            // Intent is to capture time taken for all of discovery to complete, so make sure
            // all interpreters are queried for.
            sendTelemetryEvent(EventName.PYTHON_INTERPRETER_DISCOVERY, stopWatch.elapsedTime, {
                interpreters: this.getEnvs().length,
                environmentsWithoutPython: this.getEnvs().filter(
                    (e) => getEnvPath(e.executable.filename, e.location).pathType === 'envFolderPath',
                ).length,
                trigger: trigger ?? 'auto',
            });
        }
    }
}

export async function createPythonEnvironments(getLocator: GetLocatorFunc): Promise<IDiscoveryAPI> {
    const api = new PythonEnvironments(getLocator);
    await api.activate();
    return api;
}
