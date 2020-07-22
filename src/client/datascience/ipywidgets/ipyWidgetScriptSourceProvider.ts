// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { sha256 } from 'hash.js';
import { ConfigurationChangeEvent, ConfigurationTarget } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';
import { traceError } from '../../common/logger';

import {
    IConfigurationService,
    IHttpClient,
    IPersistentState,
    IPersistentStateFactory,
    WidgetCDNs
} from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { Common, DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IInterpreterService } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { IDataScienceFileSystem, ILocalResourceUriConverter, INotebook } from '../types';
import { CDNWidgetScriptSourceProvider } from './cdnWidgetScriptSourceProvider';
import { LocalWidgetScriptSourceProvider } from './localWidgetScriptSourceProvider';
import { RemoteWidgetScriptSourceProvider } from './remoteWidgetScriptSourceProvider';
import { IWidgetScriptSourceProvider, WidgetScriptSource } from './types';

const GlobalStateKeyToTrackIfUserConfiguredCDNAtLeastOnce = 'IPYWidgetCDNConfigured';
const GlobalStateKeyToNeverWarnAboutScriptsNotFoundOnCDN = 'IPYWidgetNotFoundOnCDN';

/**
 * This class decides where to get widget scripts from.
 * Whether its cdn or local or other, and also controls the order/priority.
 * If user changes the order, this will react to those configuration setting changes.
 * If user has not configured antying, user will be presented with a prompt.
 */
export class IPyWidgetScriptSourceProvider implements IWidgetScriptSourceProvider {
    private readonly notifiedUserAboutWidgetScriptNotFound = new Set<string>();
    private scriptProviders?: IWidgetScriptSourceProvider[];
    private configurationPromise?: Deferred<void>;
    private get configuredScriptSources(): readonly WidgetCDNs[] {
        const settings = this.configurationSettings.getSettings(undefined);
        return settings.datascience.widgetScriptSources;
    }
    private readonly userConfiguredCDNAtLeastOnce: IPersistentState<boolean>;
    private readonly neverWarnAboutScriptsNotFoundOnCDN: IPersistentState<boolean>;
    constructor(
        private readonly notebook: INotebook,
        private readonly localResourceUriConverter: ILocalResourceUriConverter,
        private readonly fs: IDataScienceFileSystem,
        private readonly interpreterService: IInterpreterService,
        private readonly appShell: IApplicationShell,
        private readonly configurationSettings: IConfigurationService,
        private readonly workspaceService: IWorkspaceService,
        private readonly stateFactory: IPersistentStateFactory,
        private readonly httpClient: IHttpClient
    ) {
        this.userConfiguredCDNAtLeastOnce = this.stateFactory.createGlobalPersistentState<boolean>(
            GlobalStateKeyToTrackIfUserConfiguredCDNAtLeastOnce,
            false
        );
        this.neverWarnAboutScriptsNotFoundOnCDN = this.stateFactory.createGlobalPersistentState<boolean>(
            GlobalStateKeyToNeverWarnAboutScriptsNotFoundOnCDN,
            false
        );
    }
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
            source: found.source,
            cdnSearched: this.configuredScriptSources.length > 0
        });

        if (!found.scriptUri) {
            traceError(`Script source for Widget ${moduleName}@${moduleVersion} not found`);
        }
        this.handleWidgetSourceNotFoundOnCDN(found).ignoreErrors();
        return found;
    }
    private async handleWidgetSourceNotFoundOnCDN(widgetSource: WidgetScriptSource) {
        // if widget exists nothing to do.
        if (widgetSource.source === 'cdn' || this.neverWarnAboutScriptsNotFoundOnCDN.value === true) {
            return;
        }
        if (
            this.notifiedUserAboutWidgetScriptNotFound.has(widgetSource.moduleName) ||
            this.configuredScriptSources.length === 0
        ) {
            return;
        }
        this.notifiedUserAboutWidgetScriptNotFound.add(widgetSource.moduleName);
        const selection = await this.appShell.showWarningMessage(
            DataScience.widgetScriptNotFoundOnCDNWidgetMightNotWork().format(widgetSource.moduleName),
            Common.ok(),
            Common.doNotShowAgain(),
            Common.reportThisIssue()
        );
        switch (selection) {
            case Common.doNotShowAgain():
                return this.neverWarnAboutScriptsNotFoundOnCDN.updateValue(true);
            case Common.reportThisIssue():
                return this.appShell.openUrl('https://aka.ms/CreatePVSCDataScienceIssue');
            default:
                noop();
        }
    }

    private onSettingsChagned(e: ConfigurationChangeEvent) {
        if (e.affectsConfiguration('python.dataScience.widgetScriptSources')) {
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

        const scriptProviders: IWidgetScriptSourceProvider[] = [];

        // If we're allowed to use CDN providers, then use them, and use in order of preference.
        if (this.configuredScriptSources.length > 0) {
            scriptProviders.push(
                new CDNWidgetScriptSourceProvider(
                    this.configurationSettings,
                    this.httpClient,
                    this.localResourceUriConverter,
                    this.fs
                )
            );
        }
        if (this.notebook.connection && this.notebook.connection.localLaunch) {
            scriptProviders.push(
                new LocalWidgetScriptSourceProvider(
                    this.notebook,
                    this.localResourceUriConverter,
                    this.fs,
                    this.interpreterService
                )
            );
        } else {
            if (this.notebook.connection) {
                scriptProviders.push(new RemoteWidgetScriptSourceProvider(this.notebook.connection, this.httpClient));
            }
        }

        this.scriptProviders = scriptProviders;
    }

    private async configureWidgets(): Promise<void> {
        if (this.configuredScriptSources.length !== 0) {
            return;
        }

        if (this.userConfiguredCDNAtLeastOnce.value) {
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
            Common.cancel(),
            Common.doNotShowAgain()
        );

        let selectionForTelemetry: 'ok' | 'cancel' | 'dismissed' | 'doNotShowAgain' = 'dismissed';
        switch (selection) {
            case Common.ok(): {
                selectionForTelemetry = 'ok';
                // always search local interpreter or attempt to fetch scripts from remote jupyter server as backups.
                await Promise.all([
                    this.updateScriptSources(['jsdelivr.com', 'unpkg.com']),
                    this.userConfiguredCDNAtLeastOnce.updateValue(true)
                ]);
                break;
            }
            case Common.doNotShowAgain(): {
                selectionForTelemetry = 'doNotShowAgain';
                // At a minimum search local interpreter or attempt to fetch scripts from remote jupyter server.
                await Promise.all([this.updateScriptSources([]), this.userConfiguredCDNAtLeastOnce.updateValue(true)]);
                break;
            }
            default:
                selectionForTelemetry = selection === Common.cancel() ? 'cancel' : 'dismissed';
                break;
        }

        sendTelemetryEvent(Telemetry.IPyWidgetPromptToUseCDNSelection, undefined, { selection: selectionForTelemetry });
        this.configurationPromise.resolve();
    }
    private async updateScriptSources(scriptSources: WidgetCDNs[]) {
        const targetSetting = 'dataScience.widgetScriptSources';
        await this.configurationSettings.updateSetting(
            targetSetting,
            scriptSources,
            undefined,
            ConfigurationTarget.Global
        );
    }
}
