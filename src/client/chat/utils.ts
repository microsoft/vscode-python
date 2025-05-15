// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationError, CancellationToken, Uri } from 'vscode';
import { IDiscoveryAPI } from '../pythonEnvironments/base/locator';
import { PythonExtension, ResolvedEnvironment } from '../api/types';

export function resolveFilePath(filepath: string): Uri {
    // starts with a scheme
    try {
        return Uri.parse(filepath);
    } catch (e) {
        return Uri.file(filepath);
    }
}

/**
 * Returns a promise that rejects with an {@CancellationError} as soon as the passed token is cancelled.
 * @see {@link raceCancellation}
 */
export function raceCancellationError<T>(promise: Promise<T>, token: CancellationToken): Promise<T> {
    return new Promise((resolve, reject) => {
        const ref = token.onCancellationRequested(() => {
            ref.dispose();
            reject(new CancellationError());
        });
        promise.then(resolve, reject).finally(() => ref.dispose());
    });
}

export async function getEnvDisplayName(discovery: IDiscoveryAPI, resource: Uri, api: PythonExtension['environments']) {
    try {
        const envPath = api.getActiveEnvironmentPath(resource);
        const env = await discovery.resolveEnv(envPath.path);
        return env?.display || env?.name;
    } catch {
        return;
    }
}

export function isCondaEnv(env: ResolvedEnvironment) {
    return (env.environment?.type || '').toLowerCase() === 'conda';
}
