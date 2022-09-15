// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { CancellationToken, ProgressLocation } from 'vscode';
import { withProgress } from '../../common/vscodeApis/windowApis';
import { traceError } from '../../logging';
import { CreateEnvironmentOptions, CreateEnvironmentProgress, CreateEnvironmentProvider } from './types';
import { CreateEnv } from '../../common/utils/localize';

export async function createEnvironment(
    provider: CreateEnvironmentProvider,
    options: CreateEnvironmentOptions = {
        ignoreSourceControl: true,
        installPackages: true,
    },
): Promise<void> {
    await withProgress(
        {
            location: ProgressLocation.Notification,
            title: CreateEnv.statusTitle,
            cancellable: true,
        },
        async (progress: CreateEnvironmentProgress, token: CancellationToken) => {
            let hasError = false;
            progress.report({
                message: CreateEnv.statusStarting,
            });
            try {
                await provider.createEnvironment(options, progress, token);
            } catch (ex) {
                traceError(ex);
                hasError = true;
                progress.report({
                    message: CreateEnv.statusError,
                });
            } finally {
                if (!hasError) {
                    progress.report({
                        message: CreateEnv.statusDone,
                    });
                }
            }
        },
    );
}
