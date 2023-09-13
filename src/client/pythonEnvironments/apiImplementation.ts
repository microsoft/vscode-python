/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Event } from 'vscode';
import {
    IDiscoveryAPI,
    ProgressNotificationEvent,
    GetRefreshEnvironmentsOptions,
    PythonLocatorQuery,
    TriggerRefreshOptions,
    ProgressReportStage,
} from './base/locator';
import { ExtensionState } from '../components';
import { createLocator } from './createLocator';

/**
 * The public API for the Python environments component.
 *
 * Note that this is composed of sub-components.
 */
export class PythonEnvironments implements IDiscoveryAPI {
    private locator!: IDiscoveryAPI;

    public async activate(ext: ExtensionState): Promise<void> {
        this.locator = await createLocator(ext);
    }

    public get onProgress(): Event<ProgressNotificationEvent> {
        return this.locator.onProgress;
    }

    public get refreshState(): ProgressReportStage {
        return this.locator.refreshState;
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

    public async triggerRefresh(query?: PythonLocatorQuery, options?: TriggerRefreshOptions) {
        return this.locator.triggerRefresh(query, options);
    }
}
