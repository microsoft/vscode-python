// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import * as nls from 'vscode-nls';
import { CancellationToken, ProgressLocation } from 'vscode';
import { withProgress } from '../../common/vscodeApis/windowApis';
import { traceError, traceLog } from '../../logging';
import { CreateEnvironmentProgress, CreateEnvironmentProvider } from './types';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export async function createEnvironment(provider: CreateEnvironmentProvider): Promise<void> {
    traceLog(`Creating environment using: ${provider.name}`);
    withProgress(
        {
            location: ProgressLocation.Notification,
            title: localize('python.createEnv.status.title', 'Creating virtual environment.'),
            cancellable: true,
        },
        async (progress: CreateEnvironmentProgress, token: CancellationToken) => {
            progress.report({
                message: localize('python.createEnv.status.start', 'Creating virtual environment...'),
            });
            let hasError = false;
            try {
                await provider.createEnvironment(
                    {
                        ignoreSourceControl: true,
                        installPackages: true,
                    },
                    progress,
                    token,
                );
            } catch (ex) {
                traceError(ex);
                hasError = true;
                progress.report({
                    message: localize('python.createEnv.status.error', 'Error while virtual environment.'),
                });
            } finally {
                if (!hasError) {
                    progress.report({
                        message: localize('python.createEnv.status.done', 'Create environment completed.'),
                    });
                }
            }
        },
    );
}
