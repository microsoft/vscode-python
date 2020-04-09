// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { sha256 } from 'hash.js';
import { ConfigurationChangeEvent, ConfigurationTarget } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import {
    IConfigurationService,
    IHttpClient,
    LocalKernelScriptSource,
    RemoteKernelScriptSource
} from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { Common, DataScience } from '../../common/utils/localize';
import { IInterpreterService } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { ILocalResourceUriConverter, INotebook } from '../types';
import { CDNWidgetScriptSourceProvider } from './cdnWidgetScriptSourceProvider';
import { LocalWidgetScriptSourceProvider } from './localWidgetScriptSourceProvider';
import { RemoteWidgetScriptSourceProvider } from './remoteWidgetScriptSourceProvider';
import { IWidgetScriptSourceProvider, WidgetScriptSource } from './types';

/**
 * This class decides where to get widget scripts from.
 * Whether its cdn or local or other, and also controls the order/priority.
 * If user changes the order, this will react to those configuration setting changes.
 * If user has not configured antying, user will be presented with a prompt.
 */
export class IPyWidgetScriptSourceProvider implements IWidgetScriptSourceProvider {
    private scriptProviders?: IWidgetScriptSourceProvider[];
    private configurationPromise?: Deferred<void>;
    private get configuredScriptSources(): readonly (LocalKernelScriptSource | RemoteKernelScriptSource)[] {
        const settings = this.configurationSettings.getSettings(undefined);
        if (this.notebook.connection.localLaunch) {
            return settings.datascience.widgets.localConnectionScriptSources;
        } else {
            return settings.datascience.widgets.remoteConnectionScriptSources;
        }
    }
    constructor(
        private readonly notebook: INotebook,
        private readonly localResourceUriConverter: ILocalResourceUriConverter,
        private readonly fs: IFileSystem,
        private readonly interpreterService: IInterpreterService,
        private readonly appShell: IApplicationShell,
        private readonly configurationSettings: IConfigurationService,
        private readonly workspaceService: IWorkspaceService,
        private readonly httpClient: IHttpClient
    ) {}
    public initialize() {
        this.workspaceService.onDidChangeConfiguration(this.onSettingsChagned.bind(this));
    }
    public dispose() {
        this.disposeScriptProviders();
    }
    /**
     * We know widgets are being used, at this point prompt user if required.
     */
    public async getWidgetScriptSource(
        moduleName: string,
        moduleVersion: string
    ): Promise<Readonly<WidgetScriptSource>> {
        await this.configureWidgets();
        if (!this.scriptProviders) {
            this.rebuildProviders();
        }

        // Get script sources in order, if one works, then get out.
        const scriptSourceProviders = (this.scriptProviders || []).slice();
        let found: WidgetScriptSource = { moduleName };
        while (scriptSourceProviders.length) {
            const scriptProvider = scriptSourceProviders.shift();
            if (!scriptProvider) {
                continue;
            }
            const source = await scriptProvider.getWidgetScriptSource(moduleName, moduleVersion);
            // If we found the script source, then use that.
            if (source.scriptUri) {
                found = source;
                break;
            }
        }

        sendTelemetryEvent(Telemetry.HashedIPyWidgetNameUsed, undefined, {
            hashedName: sha256().update(found.moduleName).digest('hex'),
            source: found.source
        });
        return found;
    }
    public async getWidgetScriptSources(ignoreCache?: boolean | undefined): Promise<readonly WidgetScriptSource[]> {
        // At this point we dont need to configure the settings.
        // We don't know if widgest are being used.
        if (!this.scriptProviders) {
            this.rebuildProviders();
        }

        // Get script sources in order, if one works, then get out.
        const scriptSourceProviders = (this.scriptProviders || []).slice();
        while (scriptSourceProviders.length) {
            const scriptProvider = scriptSourceProviders.shift();
            if (!scriptProvider) {
                continue;
            }
            const sources = await scriptProvider.getWidgetScriptSources(ignoreCache);
            if (sources.length > 0) {
                sources.forEach((item) =>
                    sendTelemetryEvent(Telemetry.HashedIPyWidgetNameDiscovered, undefined, {
                        hashedName: sha256().update(item.moduleName).digest('hex'),
                        source: item.source
                    })
                );

                return sources;
            }
        }
        return [];
    }
    private onSettingsChagned(e: ConfigurationChangeEvent) {
        const isLocalConnection = this.notebook.connection.localLaunch;
        if (e.affectsConfiguration('python.datasSience.widgets.localConnectionScriptSources') && isLocalConnection) {
            this.rebuildProviders();
        }
        if (e.affectsConfiguration('python.datasSience.widgets.remoteConnectionScriptSources') && !isLocalConnection) {
            this.rebuildProviders();
        }
    }
    private disposeScriptProviders() {
        while (this.scriptProviders && this.scriptProviders.length) {
            const item = this.scriptProviders.shift();
            if (item) {
                item.dispose();
            }
        }
    }
    private rebuildProviders() {
        this.disposeScriptProviders();
        // If we haven't configured anything, then nothing to do here.
        if (this.configuredScriptSources.length === 0) {
            return;
        }
        if (this.notebook.connection.localLaunch) {
            this.scriptProviders = [
                new LocalWidgetScriptSourceProvider(
                    this.notebook,
                    this.localResourceUriConverter,
                    this.fs,
                    this.interpreterService
                )
            ];
        } else {
            this.scriptProviders = [new RemoteWidgetScriptSourceProvider(this.notebook.connection)];
        }

        // If we're allowed to use CDN providers, then use them, and use in order of preference.
        if (this.canUseCDN()) {
            const cdnProvider = new CDNWidgetScriptSourceProvider(
                this.notebook,
                this.configurationSettings,
                this.httpClient
            );

            if (this.preferCDNFirst()) {
                this.scriptProviders.splice(0, 0, cdnProvider);
            } else {
                this.scriptProviders.push(cdnProvider);
            }
        }
    }
    private canUseCDN(): boolean {
        if (!this.notebook) {
            return false;
        }
        const settings = this.configurationSettings.getSettings(undefined);
        const scriptSources = this.notebook.connection.localLaunch
            ? settings.datascience.widgets.localConnectionScriptSources
            : settings.datascience.widgets.remoteConnectionScriptSources;

        if (scriptSources.length === 0) {
            return false;
        }

        return scriptSources.indexOf('jsdelivr.com') >= 0 || scriptSources.indexOf('unpkg.com') >= 0;
    }
    /**
     * Whether we should load widgets first from CDN then from else where.
     */
    private preferCDNFirst(): boolean {
        if (!this.notebook) {
            return false;
        }
        const settings = this.configurationSettings.getSettings(undefined);
        const scriptSources = this.notebook.connection.localLaunch
            ? settings.datascience.widgets.localConnectionScriptSources
            : settings.datascience.widgets.remoteConnectionScriptSources;

        if (scriptSources.length === 0) {
            return false;
        }
        const item = scriptSources[0];
        return item === 'jsdelivr.com' || item === 'unpkg.com';
    }

    private async configureWidgets(): Promise<void> {
        if (this.configuredScriptSources.length !== 0) {
            return;
        }
        if (this.configurationPromise) {
            return this.configurationPromise.promise;
        }
        this.configurationPromise = createDeferred();
        sendTelemetryEvent(Telemetry.IPyWidgetPromptToUseCDN);
        const selection = await this.appShell.showInformationMessage(
            DataScience.useCDNForWidgets(),
            Common.ok(),
            Common.cancel()
        );
        if (selection === Common.ok()) {
            sendTelemetryEvent(Telemetry.IPyWidgetPromptToUseCDNSelection, undefined, { selection: 'ok' });
            // always search local interpreter or attempt to fetch scripts from remote jupyter server as backups.
            await this.updateScriptSources(true, ['jsdelivr.com', 'unpkg.com', 'localPythonEnvironment']);
            await this.updateScriptSources(false, ['jsdelivr.com', 'unpkg.com', 'remoteJupyterServer']);
        } else {
            const selected = selection === Common.cancel() ? 'cancel' : 'dismissed';
            sendTelemetryEvent(Telemetry.IPyWidgetPromptToUseCDNSelection, undefined, { selection: selected });
            // At a minimum search local interpreter or attempt to fetch scripts from remote jupyter server.
            await this.updateScriptSources(true, ['localPythonEnvironment']);
            await this.updateScriptSources(false, ['remoteJupyterServer']);
        }
        this.configurationPromise.resolve();
    }
    private async updateScriptSources(
        updateLocalKernelSettings: boolean,
        scriptSources: LocalKernelScriptSource[] | RemoteKernelScriptSource[]
    ) {
        const targetSetting = updateLocalKernelSettings
            ? 'dataScience.widgets.localConnectionScriptSources'
            : 'dataScience.widgets.remoteConnectionScriptSources';
        await this.configurationSettings.updateSetting(
            targetSetting,
            scriptSources,
            undefined,
            ConfigurationTarget.Global
        );
    }
}
