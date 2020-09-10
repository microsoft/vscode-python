// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { isNil } from 'lodash';
import { ConfigurationTarget, Memento, QuickPickItem, Uri } from 'vscode';
import { IClipboard, ICommandManager } from '../../common/application/types';
import { GLOBAL_MEMENTO, IConfigurationService, IMemento } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import {
    IMultiStepInput,
    IMultiStepInputFactory,
    InputFlowAction,
    InputStep,
    IQuickPickParameters
} from '../../common/utils/multiStepInput';
import { captureTelemetry } from '../../telemetry';
import { getSavedUriList } from '../common';
import { Identifiers, Settings, Telemetry } from '../constants';
import { IJupyterUriProvider, IJupyterUriProviderRegistration, JupyterServerUriHandle } from '../types';

const defaultUri = 'https://hostname:8080/?token=849d61a414abafab97bc4aab1f3547755ddc232c2b8cb7fe';

interface ISelectUriQuickPickItem extends QuickPickItem {
    newChoice: boolean;
    provider?: IJupyterUriProvider;
    url?: string;
}

@injectable()
export class JupyterServerSelector {
    private readonly localLabel = `$(zap) ${DataScience.jupyterSelectURILocalLabel()}`;
    private readonly newLabel = `$(server) ${DataScience.jupyterSelectURINewLabel()}`;
    private readonly remoteLabel = `$(server) ${DataScience.jupyterSelectURIRemoteLabel()}`;
    constructor(
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: Memento,
        @inject(IClipboard) private readonly clipboard: IClipboard,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(ICommandManager) private cmdManager: ICommandManager,
        @inject(IJupyterUriProviderRegistration)
        private extraUriProviders: IJupyterUriProviderRegistration
    ) {}

    @captureTelemetry(Telemetry.SelectJupyterURI)
    public selectJupyterURI(allowLocal: boolean): Promise<void> {
        const multiStep = this.multiStepFactory.create<{}>();
        return multiStep.run(this.startSelectingURI.bind(this, allowLocal), {});
    }

    private async startSelectingURI(
        allowLocal: boolean,
        input: IMultiStepInput<{}>,
        _state: {}
    ): Promise<InputStep<{}> | void> {
        // First step, show a quick pick to choose either the remote or the local.
        // newChoice element will be set if the user picked 'enter a new server'
        const item = await input.showQuickPick<ISelectUriQuickPickItem, IQuickPickParameters<ISelectUriQuickPickItem>>({
            placeholder: DataScience.jupyterSelectURIQuickPickPlaceholder(),
            items: await this.getUriPickList(allowLocal),
            title: allowLocal
                ? DataScience.jupyterSelectURIQuickPickTitle()
                : DataScience.jupyterSelectURIQuickPickTitleRemoteOnly()
        });
        if (item.label === this.localLabel) {
            await this.setJupyterURIToLocal();
        } else if (!item.newChoice && !item.provider) {
            await this.setJupyterURIToRemote(!isNil(item.url) ? item.url : item.label);
        } else if (!item.provider) {
            return this.selectRemoteURI.bind(this);
        } else {
            return this.selectProviderURI.bind(this, item.provider, item);
        }
    }

    private async selectProviderURI(
        provider: IJupyterUriProvider,
        item: ISelectUriQuickPickItem,
        _input: IMultiStepInput<{}>,
        _state: {}
    ): Promise<InputStep<{}> | void> {
        const result = await provider.handleQuickPick(item, true);
        if (result === 'back') {
            throw InputFlowAction.back;
        }
        if (result) {
            await this.handleProviderQuickPick(provider.id, result);
        }
    }
    private async handleProviderQuickPick(id: string, result: JupyterServerUriHandle | undefined) {
        if (result) {
            const uri = this.generateUriFromRemoteProvider(id, result);
            await this.setJupyterURIToRemote(uri);
        }
    }

    private generateUriFromRemoteProvider(id: string, result: JupyterServerUriHandle) {
        // tslint:disable-next-line: no-http-string
        return `${Identifiers.REMOTE_URI}?${Identifiers.REMOTE_URI_ID_PARAM}=${id}&${
            Identifiers.REMOTE_URI_HANDLE_PARAM
        }=${encodeURI(result)}`;
    }

    private async selectRemoteURI(input: IMultiStepInput<{}>, _state: {}): Promise<InputStep<{}> | void> {
        let initialValue = defaultUri;
        try {
            const text = await this.clipboard.readText().catch(() => '');
            const parsedUri = Uri.parse(text.trim(), true);
            // Only display http/https uris.
            initialValue = text && parsedUri && parsedUri.scheme.toLowerCase().startsWith('http') ? text : defaultUri;
        } catch {
            // We can ignore errors.
        }
        // Ask the user to enter a URI to connect to.
        const uri = await input.showInputBox({
            title: DataScience.jupyterSelectURIPrompt(),
            value: initialValue || defaultUri,
            validate: this.validateSelectJupyterURI,
            prompt: ''
        });

        if (uri) {
            await this.setJupyterURIToRemote(uri);
        }
    }

    @captureTelemetry(Telemetry.SetJupyterURIToLocal)
    private async setJupyterURIToLocal(): Promise<void> {
        const previousValue = this.configuration.getSettings(undefined).datascience.jupyterServerURI;
        await this.configuration.updateSetting(
            'dataScience.jupyterServerURI',
            Settings.JupyterServerLocalLaunch,
            undefined,
            ConfigurationTarget.Workspace
        );

        // Reload if there's a change
        if (previousValue !== Settings.JupyterServerLocalLaunch) {
            this.cmdManager
                .executeCommand('python.reloadVSCode', DataScience.reloadAfterChangingJupyterServerConnection())
                .then(noop, noop);
        }
    }

    @captureTelemetry(Telemetry.SetJupyterURIToUserSpecified)
    private async setJupyterURIToRemote(userURI: string): Promise<void> {
        const previousValue = this.configuration.getSettings(undefined).datascience.jupyterServerURI;
        await this.configuration.updateSetting(
            'dataScience.jupyterServerURI',
            userURI,
            undefined,
            ConfigurationTarget.Workspace
        );

        // Reload if there's a change
        if (previousValue !== userURI) {
            this.cmdManager
                .executeCommand('python.reloadVSCode', DataScience.reloadAfterChangingJupyterServerConnection())
                .then(noop, noop);
        }
    }
    private validateSelectJupyterURI = async (inputText: string): Promise<string | undefined> => {
        try {
            // tslint:disable-next-line:no-unused-expression
            new URL(inputText);

            // Double check http
            if (!inputText.toLowerCase().includes('http')) {
                throw new Error('Has to be http');
            }
        } catch {
            return DataScience.jupyterSelectURIInvalidURI();
        }
    };

    private async getUriPickList(allowLocal: boolean): Promise<ISelectUriQuickPickItem[]> {
        // Ask our providers to stick on items
        let providerItems: ISelectUriQuickPickItem[] = [];
        const providers = await this.extraUriProviders.getProviders();
        if (providers) {
            providers.forEach((p) => {
                const newproviderItems = p.getQuickPickEntryItems().map((i) => {
                    return { ...i, newChoice: false, provider: p };
                });
                providerItems = providerItems.concat(newproviderItems);
            });
        }

        // Always have 'local' and 'add new'
        let items: ISelectUriQuickPickItem[] = [];
        if (allowLocal) {
            items.push({ label: this.localLabel, detail: DataScience.jupyterSelectURILocalDetail(), newChoice: false });
            items = items.concat(providerItems);
            items.push({ label: this.newLabel, detail: DataScience.jupyterSelectURINewDetail(), newChoice: true });
        } else {
            items = items.concat(providerItems);
            items.push({
                label: this.remoteLabel,
                detail: DataScience.jupyterSelectURIRemoteDetail(),
                newChoice: true
            });
        }

        // Get our list of recent server connections and display that as well
        const savedURIList = getSavedUriList(this.globalState);
        savedURIList.forEach((uriItem) => {
            if (uriItem.uri) {
                const uriDate = new Date(uriItem.time);
                items.push({
                    label: !isNil(uriItem.displayName) ? uriItem.displayName : uriItem.uri,
                    detail: DataScience.jupyterSelectURIMRUDetail().format(uriDate.toLocaleString()),
                    newChoice: false,
                    url: uriItem.uri
                });
            }
        });

        return items;
    }
}
