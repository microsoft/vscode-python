// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as nls from 'vscode-nls';
import { createVenvScript } from '../../../common/process/internal/scripts';
import { CreateEnvironmentOptions, CreateEnvironmentProvider, CreateEnvironmentResult } from '../types';

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
    public async createEnvironment(options?: CreateEnvironmentOptions): Promise<CreateEnvironmentResult> {
        const args = generateCommandArgs(options);
    }

    name = 'venv';

    description: string = localize(
        'python.venvEnvironment.description',
        'Creates a `.venv` virtual environment using `venv` in the current workspace.',
    );
}
