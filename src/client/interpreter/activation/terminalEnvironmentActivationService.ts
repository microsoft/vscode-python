// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { CancellationTokenSource } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { LogOptions, traceDecorators } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { ITerminalServiceFactory } from '../../common/terminal/types';
import { Resource } from '../../common/types';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { PythonInterpreter } from '../contracts';
import { IEnvironmentActivationService } from './types';

const pyFile = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'printEnvVariablesToFile.py');

/**
 * This class will provide the environment variables of an interpreter by activating it in a terminal.
 * This has the following benefit:
 * - Using a shell that's configured by the user (using their default shell).
 * - Environment variables are dumped into a file instead of reading from stdout.
 *
 * @export
 * @class TerminalEnvironmentActivationService
 * @implements {IEnvironmentActivationService}
 * @implements {IDisposable}
 */
@injectable()
export class TerminalEnvironmentActivationService implements IEnvironmentActivationService {
    constructor(
        @inject(ITerminalServiceFactory) private readonly terminalFactory: ITerminalServiceFactory,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsProvider: IEnvironmentVariablesProvider
    ) {}
    @traceDecorators.verbose('getActivatedEnvironmentVariables', LogOptions.Arguments)
    @captureTelemetry(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, { failed: false, activatedInTerminal: true }, true)
    public async getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonInterpreter | undefined,
        _allowExceptions?: boolean | undefined
    ): Promise<NodeJS.ProcessEnv | undefined> {
        const env = (await this.envVarsProvider.getCustomEnvironmentVariables(resource)) as { [key: string]: string | null } | undefined;
        const terminal = this.terminalFactory.getTerminalService({
            env,
            hideFromUser: true,
            interpreter,
            resource,
            title: `${interpreter?.displayName}${new Date().getTime()}`
        });

        const command = interpreter?.path || 'python';
        const jsonFile = await this.fs.createTemporaryFile('.json');

        try {
            // Pass a cancellation token to ensure we wait until command has completed.
            // If there are any errors in executing in the terminal, throw them so they get logged and bubbled up.
            await terminal.sendCommand(command, [pyFile.fileToCommandArgument(), jsonFile.filePath.fileToCommandArgument()], new CancellationTokenSource().token, false);

            const contents = await this.fs.readFile(jsonFile.filePath);
            return JSON.parse(contents);
        } finally {
            // We created a hidden terminal for temp usage, hence dispose when done.
            terminal.dispose();
            jsonFile.dispose();
        }
    }
}
