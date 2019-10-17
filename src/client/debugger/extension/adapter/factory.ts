// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { DebugAdapterDescriptor, DebugAdapterExecutable, DebugAdapterServer, DebugSession, WorkspaceFolder } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { traceVerbose } from '../../../common/logger';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService } from '../../../interpreter/contracts';
import { RemoteDebugOptions } from '../../debugAdapter/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';
import { IDebugAdapterDescriptorFactory } from '../types';

export const ptvsdPathStorageKey = 'PTVSD_PATH_STORAGE_KEY';

@injectable()
export class DebugAdapterDescriptorFactory implements IDebugAdapterDescriptorFactory {
    constructor(
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell
    ) { }
    public async createDebugAdapterDescriptor(session: DebugSession, _executable: DebugAdapterExecutable | undefined): Promise<DebugAdapterDescriptor> {
        const configuration = session.configuration as (LaunchRequestArguments | AttachRequestArguments);
        if (configuration.request === 'attach') {
            const port = configuration.port ? configuration.port : 0;
            if (port === 0) {
                throw new Error('Port must be specified for request type attach');
            }
            return new DebugAdapterServer(port, configuration.host);
        } else {
            const pythonPath = await this.getPythonPath(configuration, session.workspaceFolder);
            const interpreterInfo = await this.interpreterService.getInterpreterDetails(pythonPath);
            if (!interpreterInfo || !interpreterInfo.version) {
                throw new Error('Debug Adapter Executable requires a Python Interpreter.');
            }
            // If logToFile is set in the debug config then pass --log-dir <path-to-extension-dir> when launching the debug adapter.
            const logArgs = configuration.logToFile ? ['--log-dir', EXTENSION_ROOT_DIR] : [];
            const ptvsdPathToUse = this.getPtvsdPath();
            if (!configuration.debugAdapterPath) {
                return new DebugAdapterExecutable(`${pythonPath}`, [path.join(ptvsdPathToUse, 'adapter'), ...logArgs]);
            } else {
                return new DebugAdapterExecutable(`${pythonPath}`, [configuration.debugAdapterPath, ...logArgs]);
            }
        }
    }

    public getPtvsdPath(): string {
        const ptvsdPathToUse = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python');
        return path.join(ptvsdPathToUse, 'ptvsd');
    }

    public getRemotePtvsdArgs(remoteDebugOptions: RemoteDebugOptions): string[] {
        const waitArgs = remoteDebugOptions.waitUntilDebuggerAttaches ? ['--wait'] : [];
        return ['--default', '--host', remoteDebugOptions.host, '--port', remoteDebugOptions.port.toString(), ...waitArgs];
    }

    /**
     * Get the python executable used to launch the Python Debug Adapter.
     * In the case of `attach` scenarios, just use the workspace interpreter, else first available one.
     * It is unlike user won't have a Python interpreter
     *
     * @private
     * @param {(LaunchRequestArguments | AttachRequestArguments)} configuration
     * @param {WorkspaceFolder} [workspaceFolder]
     * @returns {Promise<string>} Path to the python interpreter for this workspace.
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
            return '';
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
        await this.appShell.showErrorMessage('Please install Python or select a Python Interpreter to use the debugger.');
    }
}
