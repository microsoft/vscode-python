// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { getGlobalStorage } from '../common/persistentState';
import { ActivationResult, ExtensionState } from '../components';
import { PythonEnvInfo } from './base/info';
import { IDiscoveryAPI } from './base/locator';
import {
    initializeExternalDependencies as initializeLegacyExternalDependencies,
    normCasePath,
} from './common/externalDependencies';
import { registerNewDiscoveryForIOC } from './legacyIOC';
import { createPythonEnvironments } from './api';

/**
 * Set up the Python environments component (during extension activation).'
 */
export async function initialize(ext: ExtensionState): Promise<IDiscoveryAPI> {
    // Set up the legacy IOC container before api is created.
    initializeLegacyExternalDependencies(ext.legacyIOC.serviceContainer);

    const api = await createPythonEnvironments(ext);
    registerNewDiscoveryForIOC(
        // These are what get wrapped in the legacy adapter.
        ext.legacyIOC.serviceManager,
        api,
    );
    return api;
}

/**
 * Make use of the component (e.g. register with VS Code).
 */
export async function activate(api: IDiscoveryAPI, ext: ExtensionState): Promise<ActivationResult> {
    /**
     * Force an initial background refresh of the environments.
     *
     * Note API is ready to be queried only after a refresh has been triggered, and extension activation is
     * blocked on API being ready. So if discovery was never triggered for a scope, we need to block
     * extension activation on the "refresh trigger".
     */
    const folders = vscode.workspace.workspaceFolders;
    // Trigger discovery if environment cache is empty.
    const wasTriggered = getGlobalStorage<PythonEnvInfo[]>(ext.context, 'PYTHON_ENV_INFO_CACHE', []).get().length > 0;
    if (!wasTriggered) {
        api.triggerRefresh().ignoreErrors();
        folders?.forEach(async (folder) => {
            const wasTriggeredForFolder = getGlobalStorage<boolean>(
                ext.context,
                `PYTHON_WAS_DISCOVERY_TRIGGERED_${normCasePath(folder.uri.fsPath)}`,
                false,
            );
            await wasTriggeredForFolder.set(true);
        });
    } else {
        // Figure out which workspace folders need to be activated if any.
        folders?.forEach(async (folder) => {
            const wasTriggeredForFolder = getGlobalStorage<boolean>(
                ext.context,
                `PYTHON_WAS_DISCOVERY_TRIGGERED_${normCasePath(folder.uri.fsPath)}`,
                false,
            );
            if (!wasTriggeredForFolder.get()) {
                api.triggerRefresh({
                    searchLocations: { roots: [folder.uri], doNotIncludeNonRooted: true },
                }).ignoreErrors();
                await wasTriggeredForFolder.set(true);
            }
        });
    }

    return {
        fullyReady: Promise.resolve(),
    };
}
