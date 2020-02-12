// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { ConfigurationTarget, Memento, QuickPickItem } from 'vscode';
import { GLOBAL_MEMENTO, IConfigurationService, IMemento } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import {
    IMultiStepInput,
    IMultiStepInputFactory,
    InputStep,
    IQuickPickParameters
} from '../../common/utils/multiStepInput';
import { captureTelemetry } from '../../telemetry';
import { getSavedUriList } from '../common';
import { Settings, Telemetry } from '../constants';

interface ISelectUriQuickPickItem extends QuickPickItem {
    newChoice: boolean;
}

@injectable()
export class JupyterServerSelector {
    private readonly localLabel = `$(zap) ${DataScience.jupyterSelectURILocalLabel()}`;
    private readonly newLabel = `$(server) ${DataScience.jupyterSelectURINewLabel()}`;
    constructor(
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: Memento,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IConfigurationService) private configuration: IConfigurationService
    ) {}

    @captureTelemetry(Telemetry.SelectJupyterURI)
    public selectJupyterURI(): Promise<void> {
        const multiStep = this.multiStepFactory.create<{}>();
        return multiStep.run(this.startSelectingURI.bind(this), {});
    }

    private async startSelectingURI(input: IMultiStepInput<{}>, _state: {}): Promise<InputStep<{}> | void> {
        // First step, show a quick pick to choose either the remote or the local.
        // newChoice element will be set if the user picked 'enter a new server'
        const item = await input.showQuickPick<ISelectUriQuickPickItem, IQuickPickParameters<ISelectUriQuickPickItem>>({
            placeholder: DataScience.jupyterSelectURIQuickPickPlaceholder(),
            items: this.getUriPickList(),
            title: DataScience.jupyterSelectURIQuickPickTitle()
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
        // Ask the user to enter a URI to connect to.
        const uri = await input.showInputBox({
            title: DataScience.jupyterSelectURIPrompt(),
            value: 'https://hostname:8080/?token=849d61a414abafab97bc4aab1f3547755ddc232c2b8cb7fe',
            validate: this.validateSelectJupyterURI,
            prompt: ''
        });

        if (uri) {
            await this.setJupyterURIToRemote(uri);
        }
    }

    @captureTelemetry(Telemetry.SetJupyterURIToLocal)
    private async setJupyterURIToLocal(): Promise<void> {
        await this.configuration.updateSetting(
            'dataScience.jupyterServerURI',
            Settings.JupyterServerLocalLaunch,
            undefined,
            ConfigurationTarget.Workspace
        );
    }

    @captureTelemetry(Telemetry.SetJupyterURIToUserSpecified)
    private async setJupyterURIToRemote(userURI: string): Promise<void> {
        await this.configuration.updateSetting(
            'dataScience.jupyterServerURI',
            userURI,
            undefined,
            ConfigurationTarget.Workspace
        );
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

    private getUriPickList(): ISelectUriQuickPickItem[] {
        // Always have 'local' and 'add new'
        const items: ISelectUriQuickPickItem[] = [];
        items.push({ label: this.localLabel, detail: DataScience.jupyterSelectURILocalDetail(), newChoice: false });
        items.push({ label: this.newLabel, detail: DataScience.jupyterSelectURINewDetail(), newChoice: true });

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
