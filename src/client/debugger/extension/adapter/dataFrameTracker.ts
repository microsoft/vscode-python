// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import {
    DebugAdapterTracker,
    DebugAdapterTrackerFactory,
    DebugSession,
    ProviderResult,
    window,
    l10n,
    commands,
} from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';

import { IExtensions } from '../../../common/types';
import { JUPYTER_EXTENSION_ID } from '../../../common/constants';

/**
 * Debug adapter tracker that monitors for dataframe-like variables
 * and suggests installing the Jupyter extension when they are detected
 * but the Jupyter extension is not installed.
 */
class DataFrameVariableTracker implements DebugAdapterTracker {
    private readonly extensions: IExtensions;
    private hasNotifiedAboutJupyter = false;

    // Types that are considered dataframe-like
    private readonly dataFrameTypes = [
        'pandas.core.frame.DataFrame',
        'pandas.DataFrame',
        'polars.DataFrame',
        'cudf.DataFrame',
        'dask.dataframe.core.DataFrame',
        'modin.pandas.DataFrame',
        'vaex.dataframe.DataFrame',
        'geopandas.geodataframe.GeoDataFrame',
    ];

    constructor(_session: DebugSession, extensions: IExtensions) {
        this.extensions = extensions;
    }

    public onDidSendMessage(message: DebugProtocol.Message): void {
        if (this.hasNotifiedAboutJupyter) {
            return; // Only notify once per debug session
        }

        // Check if this is a variables response
        if ('type' in message && message.type === 'response' && 'command' in message && message.command === 'variables') {
            const response = message as unknown as DebugProtocol.VariablesResponse;
            if (response.success && response.body?.variables) {
                this.checkForDataFrameVariables(response.body.variables);
            }
        }
    }

    private checkForDataFrameVariables(variables: DebugProtocol.Variable[]): boolean {
        // Check if any variable is a dataframe-like object
        const hasDataFrame = variables.some((variable) =>
            this.dataFrameTypes.some((dfType) =>
                variable.type?.includes(dfType) || 
                variable.value?.includes(dfType) ||
                // Also check if the variable name suggests it's a dataframe
                (variable.name?.match(/^(df|data|dataframe)/i) && variable.type?.includes('pandas'))
            )
        );

        if (hasDataFrame) {
            this.checkAndNotifyJupyterExtension();
        }

        return hasDataFrame;
    }

    private checkAndNotifyJupyterExtension(): void {
        // Check if Jupyter extension is installed
        const jupyterExtension = this.extensions.getExtension(JUPYTER_EXTENSION_ID);
        
        if (!jupyterExtension) {
            this.hasNotifiedAboutJupyter = true;
            this.showJupyterInstallNotification();
        }
    }

    private showJupyterInstallNotification(): void {
        const message = l10n.t('Install Jupyter extension to inspect dataframe objects in the data viewer.');
        const installAction = l10n.t('Install Jupyter Extension');
        const dismissAction = l10n.t('Dismiss');

        window.showInformationMessage(message, installAction, dismissAction).then((selection) => {
            if (selection === installAction) {
                // Open the extension marketplace for the Jupyter extension
                commands.executeCommand('extension.open', JUPYTER_EXTENSION_ID);
            }
        });
    }
}

@injectable()
export class DataFrameTrackerFactory implements DebugAdapterTrackerFactory {
    constructor(@inject(IExtensions) private readonly extensions: IExtensions) {}

    public createDebugAdapterTracker(session: DebugSession): ProviderResult<DebugAdapterTracker> {
        return new DataFrameVariableTracker(session, this.extensions);
    }
}