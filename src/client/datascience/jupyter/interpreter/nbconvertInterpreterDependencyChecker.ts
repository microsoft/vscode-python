// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { SemVer } from 'semver';
import { CancellationToken } from 'vscode';
import { IInstaller, Product } from '../../../common/types';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { parseSemVer } from '../../common';
import { JupyterCommands } from '../../constants';
import { IJupyterCommandFactory, INbConvertInterpreterDependencyChecker } from '../../types';

@injectable()
export class NbConvertInterpreterDependencyChecker implements INbConvertInterpreterDependencyChecker {
    // Track interpreters that nbconvert has been installed into
    private readonly nbconvertInstalledInInterpreter = new Set<string>();
    constructor(
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IJupyterCommandFactory) private readonly commandFactory: IJupyterCommandFactory
    ) {}

    // Check to see if nbconvert is installed in the given interpreter
    public async isNbConvertInstalled(interpreter: PythonEnvironment, _token?: CancellationToken): Promise<boolean> {
        if (this.nbconvertInstalledInInterpreter.has(interpreter.path)) {
            return true;
        }
        const installed = this.installer.isInstalled(Product.nbconvert, interpreter).then((result) => result === true);
        if (installed) {
            this.nbconvertInstalledInInterpreter.add(interpreter.path);
        }
        return installed;
    }

    // Get the specific version of nbconvert installed in the given interpreter
    public async getNbConvertVersion(
        interpreter: PythonEnvironment,
        _token?: CancellationToken
    ): Promise<SemVer | undefined> {
        const command = this.commandFactory.createInterpreterCommand(
            JupyterCommands.ConvertCommand,
            'jupyter',
            ['-m', 'jupyter', 'nbconvert'],
            interpreter,
            false
        );

        const result = await command.exec(['--version'], { throwOnStdErr: true });

        return parseSemVer(result.stdout);
    }
}
