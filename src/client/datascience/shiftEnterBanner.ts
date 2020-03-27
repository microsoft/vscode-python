// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IConfigurationService, IPersistentStateFactory, IPythonExtensionBanner } from '../common/types';
import * as localize from '../common/utils/localize';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry';
import { Telemetry } from './constants';
import { IJupyterExecution } from './types';

export enum InteractiveShiftEnterStateKeys {
    ShowBanner = 'InteractiveShiftEnterBanner',
}

enum InteractiveShiftEnterLabelIndex {
    Yes,
    No,
}

// Create a banner to ask users if they want to send shift-enter to the interactive window or not
@injectable()
export class InteractiveShiftEnterBanner implements IPythonExtensionBanner {
    private initialized?: boolean;
    private disabledInCurrentSession: boolean = false;
    private bannerMessage: string = localize.InteractiveShiftEnterBanner.bannerMessage();
    private bannerLabels: string[] = [
        localize.InteractiveShiftEnterBanner.bannerLabelYes(),
        localize.InteractiveShiftEnterBanner.bannerLabelNo(),
    ];

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IConfigurationService) private configuration: IConfigurationService
    ) {
        this.initialize();
    }

    public initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        if (!this.enabled) {
            return;
        }
    }

    public get enabled(): boolean {
        return this.persistentState.createGlobalPersistentState<boolean>(
            InteractiveShiftEnterStateKeys.ShowBanner,
            true
        ).value;
    }

    public async showBanner(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        const show = await this.shouldShowBanner();
        if (!show) {
            return;
        }

        // This check is independent from shouldShowBanner, that just checks the persistent state.
        // The Jupyter check should only happen once and should disable the banner if it fails (don't reprompt and don't recheck)
        const jupyterFound = await this.jupyterExecution.isNotebookSupported();
        if (!jupyterFound) {
            await this.disableBanner();
            return;
        }

        sendTelemetryEvent(Telemetry.ShiftEnterBannerShown);
        const response = await this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
        switch (response) {
            case this.bannerLabels[InteractiveShiftEnterLabelIndex.Yes]: {
                await this.enableInteractiveShiftEnter();
                break;
            }
            case this.bannerLabels[InteractiveShiftEnterLabelIndex.No]: {
                await this.disableInteractiveShiftEnter();
                break;
            }
            default: {
                // Disable for the current session.
                this.disabledInCurrentSession = true;
            }
        }
    }

    public async shouldShowBanner(): Promise<boolean> {
        const settings = this.configuration.getSettings();
        return Promise.resolve(
            this.enabled &&
                !this.disabledInCurrentSession &&
                !settings.datascience.sendSelectionToInteractiveWindow &&
                settings.datascience.enabled
        );
    }

    @captureTelemetry(Telemetry.DisableInteractiveShiftEnter)
    public async disableInteractiveShiftEnter(): Promise<void> {
        await this.configuration.updateSetting(
            'dataScience.sendSelectionToInteractiveWindow',
            false,
            undefined,
            ConfigurationTarget.Global
        );
        await this.disableBanner();
    }

    @captureTelemetry(Telemetry.EnableInteractiveShiftEnter)
    public async enableInteractiveShiftEnter(): Promise<void> {
        await this.configuration.updateSetting(
            'dataScience.sendSelectionToInteractiveWindow',
            true,
            undefined,
            ConfigurationTarget.Global
        );
        await this.disableBanner();
    }

    private async disableBanner(): Promise<void> {
        await this.persistentState
            .createGlobalPersistentState<boolean>(InteractiveShiftEnterStateKeys.ShowBanner, false)
            .updateValue(false);
    }
}
