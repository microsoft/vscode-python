// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IDisposableRegistry } from '../common/types';
import { getConfiguration, getWorkspaceFolders, onDidChangeConfiguration } from '../common/vscodeApis/workspaceApis';
import { getEnvExtensionDecisionTelemetry } from './api.internal';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { EnvsExplicitFalseScope } from '../telemetry/types';

/**
 * Reports which scope kinds explicitly configure python.useEnvironmentsExtension to false.
 * Defaults and precedence are not applied: overridden false values are still reported.
 * Multiple folders count as one scope kind; no setting values or paths are changed.
 */
export function getEnvsExplicitFalseScope(): EnvsExplicitFalseScope {
    const folders = getWorkspaceFolders() ?? [];
    const inspection = getConfiguration('python', folders[0]?.uri).inspect<boolean>('useEnvironmentsExtension');
    const scopes: EnvsExplicitFalseScope[] = [];
    if (inspection?.globalValue === false) {
        scopes.push('user');
    }
    if (inspection?.workspaceValue === false) {
        scopes.push('workspace');
    }
    if (
        folders.some(
            (folder) =>
                getConfiguration('python', folder.uri).inspect<boolean>('useEnvironmentsExtension')
                    ?.workspaceFolderValue === false,
        )
    ) {
        scopes.push('folder');
    }
    return scopes.length > 1 ? 'multiple' : scopes[0] ?? 'none';
}

/**
 * Reports the current explicit-false scopes when the integration setting changes.
 * Registers the listener in disposables without changing the cached integration decision.
 * A notification reports configuration, not necessarily an intentional user opt-out.
 */
export function registerEnvironmentsExtensionTelemetry(disposables: IDisposableRegistry): void {
    disposables.push(
        onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('python.useEnvironmentsExtension')) {
                sendTelemetryEvent(EventName.ENVIRONMENTS_EXTENSION_SETTING_CHANGED, undefined, {
                    envsExplicitFalseScope: getEnvsExplicitFalseScope(),
                    ...getEnvExtensionDecisionTelemetry(),
                });
            }
        }),
    );
}
