// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken } from 'vscode';
import * as nls from 'vscode-nls';
import { PVSC_EXTENSION_ID } from '../../../common/constants';
import { createVenvScript } from '../../../common/process/internal/scripts';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { traceError, traceLog } from '../../../logging';
import { IDiscoveryAPI } from '../../base/locator';
import { CreateEnvironmentOptions, CreateEnvironmentProvider } from '../types';
import { getVenvWorkspaceFolder } from './venvWorkspaceSelection';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

function generateCommandArgs(options?: CreateEnvironmentOptions): string[] {
    let addGitIgnore = true;
    let installPackages = true;
    if (options) {
        addGitIgnore = options?.ignoreSourceControl !== undefined ? options.ignoreSourceControl : true;
        installPackages = options?.installPackages !== undefined ? options.installPackages : true;
    }

    const command: string[] = [createVenvScript()];

    if (addGitIgnore) {
        command.push('--git-ignore');
    }

    if (installPackages) {
        command.push('--install');
    }

    return command;
}

export class VenvCreationProvider implements CreateEnvironmentProvider {
    constructor(private readonly discoveryApi: IDiscoveryAPI) {}

    public async createEnvironment(options?: CreateEnvironmentOptions, token?: CancellationToken): Promise<void> {
        const deferred = createDeferred();
        const workspace = await getVenvWorkspaceFolder();
        if (workspace === undefined) {
            traceError('Workspace was not selected or found for creating virtual env.');
            return;
        }

        const interpreters = this.discoveryApi.getEnvs();
        if (interpreters.length > 0) {
            const args = generateCommandArgs(options);
            const command = interpreters[0].executable.filename;
            traceLog('Running Env creation script: ', [command, ...args]);
            const { out, dispose } = execObservable(command, args, {
                mergeStdOutErr: true,
                token,
            });

            let output = '';
            out.subscribe(
                (value) => {
                    traceLog(value.out);
                    output = output.concat(value.out);
                },
                (error) => {
                    traceError('Error while running venv creation script: ', error);
                    deferred.reject(error);
                },
                () => {
                    dispose();
                    if (!deferred.rejected) {
                        deferred.resolve();
                    }
                },
            );
        }

        await deferred.promise;
    }

    name = 'venv';

    description: string = localize(
        'python.venv.description',
        'Creates a `.venv` virtual environment using `venv` in the current workspace.',
    );

    id = `${PVSC_EXTENSION_ID}:venv`;
}
