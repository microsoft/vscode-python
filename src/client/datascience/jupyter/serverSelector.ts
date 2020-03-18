// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { ConfigurationTarget, Memento, QuickPickItem, Uri } from 'vscode';
import { IClipboard, ICommandManager } from '../../common/application/types';
import { GLOBAL_MEMENTO, IConfigurationService, IMemento } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import {
    IMultiStepInput,
    IMultiStepInputFactory,
    InputStep,
    IQuickPickParameters
} from '../../common/utils/multiStepInput';
import { captureTelemetry } from '../../telemetry';
import { getSavedUriList } from '../common';
import { Settings, Telemetry } from '../constants';

const defaultUri = 'https://hostname:8080/?token=849d61a414abafab97bc4aab1f3547755ddc232c2b8cb7fe';

interface ISelectUriQuickPickItem extends QuickPickItem {
    newChoice: boolean;
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
        @inject(ICommandManager) private cmdManager: ICommandManager
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
            items: this.getUriPickList(allowLocal),
            title: allowLocal
                ? DataScience.jupyterSelectURIQuickPickTitle()
                : DataScience.jupyterSelectURIQuickPickTitleRemoteOnly()
        });
        if (item.label === this.localLabel) {
            await this.setJupyterURIToLocal();
        } else if (!item.newChoice) {
            await this.setJupyterURIToRemote(item.label);
        } else {
            return this.selectRemoteURI.bind(this);
        }
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

    private getUriPickList(allowLocal: boolean): ISelectUriQuickPickItem[] {
        // Always have 'local' and 'add new'
        const items: ISelectUriQuickPickItem[] = [];
        if (allowLocal) {
            items.push({ label: this.localLabel, detail: DataScience.jupyterSelectURILocalDetail(), newChoice: false });
            items.push({ label: this.newLabel, detail: DataScience.jupyterSelectURINewDetail(), newChoice: true });
        } else {
            items.push({
                label: this.remoteLabel,
                detail: DataScience.jupyterSelectURIRemoteDetail(),
                newChoice: true
            });
        }

        // Get our list of recent server connections and display that as well
        const savedURIList = getSavedUriList(this.globalState);
        savedURIList.forEach(uriItem => {
            if (uriItem.uri) {
                const uriDate = new Date(uriItem.time);
                items.push({
                    label: uriItem.uri,
                    detail: DataScience.jupyterSelectURIMRUDetail().format(uriDate.toLocaleString()),
                    newChoice: false
                });
            }
        });

        return items;
    }
}
