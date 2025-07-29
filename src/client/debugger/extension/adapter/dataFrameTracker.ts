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
 * Debug adapter tracker that monitors for dataframe-like variables during debugging sessions
 * and suggests installing the Jupyter extension when they are detected but the Jupyter extension 
 * is not installed. This helps users discover the data viewer functionality when working with
 * dataframes without the Jupyter extension.
 */
class DataFrameVariableTracker implements DebugAdapterTracker {
    private readonly extensions: IExtensions;
    
    /** Flag to ensure we only show the notification once per debug session to avoid spam */
    private hasNotifiedAboutJupyter = false;

    /** 
     * Known dataframe type patterns from popular Python data processing libraries.
     * These patterns are matched against variable type strings in debug protocol responses.
     */
    private readonly dataFrameTypes = [
        'pandas.core.frame.DataFrame',  // Full pandas path
        'pandas.DataFrame',             // Simplified pandas
        'polars.DataFrame',             // Polars dataframes
        'cudf.DataFrame',               // RAPIDS cuDF
        'dask.dataframe.core.DataFrame', // Dask distributed dataframes
        'modin.pandas.DataFrame',       // Modin pandas-compatible
        'vaex.dataframe.DataFrame',     // Vaex out-of-core dataframes
        'geopandas.geodataframe.GeoDataFrame', // GeoPandas geographic data
    ];

    constructor(_session: DebugSession, extensions: IExtensions) {
        this.extensions = extensions;
    }

    /**
     * Intercepts debug protocol messages to monitor for variable responses.
     * When a variables response is detected, checks for dataframe-like objects.
     * 
     * @param message - Debug protocol message from the debug adapter
     */
    public onDidSendMessage(message: DebugProtocol.Message): void {
        if (this.hasNotifiedAboutJupyter) {
            return; // Only notify once per debug session
        }

        // Check if this is a variables response from the debug protocol
        if ('type' in message && message.type === 'response' && 'command' in message && message.command === 'variables') {
            const response = message as unknown as DebugProtocol.VariablesResponse;
            if (response.success && response.body?.variables) {
                this.checkForDataFrameVariables(response.body.variables);
            }
        }
    }

    /**
     * Examines an array of debug variables to detect dataframe-like objects.
     * Uses multiple detection strategies: type matching, value inspection, and name heuristics.
     * 
     * @param variables - Array of variables from debug protocol variables response
     * @returns true if any dataframe-like variables were detected
     */
    private checkForDataFrameVariables(variables: DebugProtocol.Variable[]): boolean {
        // Check if any variable is a dataframe-like object using multiple detection methods
        const hasDataFrame = variables.some((variable) =>
            this.dataFrameTypes.some((dfType) =>
                variable.type?.includes(dfType) || 
                variable.value?.includes(dfType) ||
                // Also check if the variable name suggests it's a dataframe (common naming patterns)
                (variable.name?.match(/^(df|data|dataframe)/i) && variable.type?.includes('pandas'))
            )
        );

        if (hasDataFrame) {
            this.checkAndNotifyJupyterExtension();
        }

        return hasDataFrame;
    }

    /**
     * Checks if the Jupyter extension is installed and shows notification if not.
     * This is the core logic that determines whether the user needs the suggestion.
     */
    private checkAndNotifyJupyterExtension(): void {
        // Check if Jupyter extension is installed using VS Code extension API
        const jupyterExtension = this.extensions.getExtension(JUPYTER_EXTENSION_ID);
        
        if (!jupyterExtension) {
            this.hasNotifiedAboutJupyter = true;
            this.showJupyterInstallNotification();
        }
    }

    /**
     * Displays an information message suggesting Jupyter extension installation.
     * Provides a direct action button to open the extension marketplace.
     */
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

/**
 * Factory for creating DataFrameVariableTracker instances for debug sessions.
 * This factory is registered with VS Code's debug adapter tracker system to
 * automatically monitor all Python debug sessions for dataframe variables.
 */
@injectable()
export class DataFrameTrackerFactory implements DebugAdapterTrackerFactory {
    constructor(@inject(IExtensions) private readonly extensions: IExtensions) {}

    /**
     * Creates a new DataFrameVariableTracker for each debug session.
     * Each debug session gets its own tracker instance to maintain session-specific state.
     * 
     * @param session - The debug session that this tracker will monitor
     * @returns A new DataFrameVariableTracker instance
     */
    public createDebugAdapterTracker(session: DebugSession): ProviderResult<DebugAdapterTracker> {
        return new DataFrameVariableTracker(session, this.extensions);
    }
}