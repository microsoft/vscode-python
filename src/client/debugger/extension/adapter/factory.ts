// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { DebugAdapterDescriptor, DebugAdapterDescriptorFactory as VSCDADescriptionFactory, DebugAdapterExecutable, DebugSession, WorkspaceFolder } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { traceVerbose } from '../../../common/logger';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService } from '../../../interpreter/contracts';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';

const ptvsdPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'ptvsd');

@injectable()
export class DebugAdapterDescriptorFactory implements VSCDADescriptionFactory {
    constructor(@inject(IInterpreterService) private readonly interpreterService: IInterpreterService, @inject(IApplicationShell) private readonly appShell: IApplicationShell) {}
    public async createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable | undefined): Promise<DebugAdapterDescriptor> {
        if ('experiment' in session.configuration && session.configuration.experiment) {
            const configuration = session.configuration as (LaunchRequestArguments | AttachRequestArguments);
            const logArgs = configuration.logToFile ? ['--log-dir', EXTENSION_ROOT_DIR] : [];
            const pythonPath = await this.getPythonPath(configuration, session.workspaceFolder);
            // tslint:disable-next-line: no-any
            const ptvsdPathToUse = 'ptvsd' in configuration ? (configuration as any).ptvsd : ptvsdPath;
            return new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPathToUse, 'adapter'), ...logArgs]);
        }
        if (executable) {
            return executable;
        }
        // Unlikely scenario.
        throw new Error('Debug Adapter Executable not provided');
    }
    /**
     * Get the python executable used to launch the Python Debug Adapter.
     * In the case of `attach` scenarios, just use the workspace interpreter, else first available one.
     * It is unlike user won't have a Python interpreter
     *
     * @private
     * @param {(LaunchRequestArguments | AttachRequestArguments)} configuration
     * @param {WorkspaceFolder} [workspaceFolder]
     * @returns {Promise<string>}
     * @memberof DebugAdapterDescriptorFactory
     */
    private async getPythonPath(configuration: LaunchRequestArguments | AttachRequestArguments, workspaceFolder?: WorkspaceFolder): Promise<string> {
        if (configuration.pythonPath) {
            return configuration.pythonPath;
        }
        const resourceUri = workspaceFolder ? workspaceFolder.uri : undefined;
        const interpreter = await this.interpreterService.getActiveInterpreter(resourceUri);
        if (interpreter) {
            traceVerbose(`Selecting active interpreter as Python Executable for DA '${interpreter.path}'`);
            return interpreter.path;
        }

        const interpreters = await this.interpreterService.getInterpreters(resourceUri);
        if (interpreters.length === 0) {
            this.notifySelectInterpreter().ignoreErrors();
        }

        traceVerbose(`Picking first available interpreter to launch the DA '${interpreters[0].path}'`);
        return interpreters[0].path;
    }
    /**
     * Notify user about the requirement for Python.
     * Unlikely scenario, as ex expect users to have Python in order to use the extension.
     * However it is possible to ignore the warnings and continue using the extension.
     *
     * @private
     * @memberof DebugAdapterDescriptorFactory
     */
    private async notifySelectInterpreter() {
        // tslint:disable-next-line: messages-must-be-localized
        await this.appShell.showErrorMessage('Please install Python or select a Python Interpereter to use the debugger.');
    }
}
