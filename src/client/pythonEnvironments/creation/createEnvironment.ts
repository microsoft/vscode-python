// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { CancellationToken, ProgressLocation } from 'vscode';
import { withProgress } from '../../common/vscodeApis/windowApis';
import { traceError } from '../../logging';
import { CreateEnvironmentOptions, CreateEnvironmentProgress, CreateEnvironmentProvider } from './types';
import { Common, CreateEnv } from '../../common/utils/localize';
import { Commands } from '../../common/constants';

export async function createEnvironment(
    provider: CreateEnvironmentProvider,
    options: CreateEnvironmentOptions = {
        ignoreSourceControl: true,
        installPackages: true,
    },
): Promise<string | undefined> {
    return withProgress(
        {
            location: ProgressLocation.Notification,
            title: `${CreateEnv.statusTitle} ([${Common.showLogs}](command:${Commands.ViewOutput}))`,
            cancellable: true,
        },
        async (progress: CreateEnvironmentProgress, token: CancellationToken) => {
            let hasError = false;
            progress.report({
                message: CreateEnv.statusStarting,
            });
            try {
                const result = await provider.createEnvironment(options, progress, token);
                return result;
            } catch (ex) {
                traceError(ex);
                hasError = true;
                progress.report({
                    message: CreateEnv.statusError,
                });
                throw ex;
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
