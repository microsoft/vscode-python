// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import {
    DebugAdapterDescriptor,
    DebugAdapterExecutable,
    DebugAdapterServer,
    DebugSession,
    WorkspaceFolder
} from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { DebugAdapterNewPtvsd } from '../../../common/experimentGroups';
import { traceVerbose } from '../../../common/logger';
import { IExperimentsManager } from '../../../common/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService } from '../../../interpreter/contracts';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { RemoteDebugOptions } from '../../debugAdapter/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';
import { IDebugAdapterDescriptorFactory } from '../types';

export const ptvsdPathStorageKey = 'PTVSD_PATH_STORAGE_KEY';

@injectable()
export class DebugAdapterDescriptorFactory implements IDebugAdapterDescriptorFactory {
    constructor(
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager
    ) {}
    public async createDebugAdapterDescriptor(
        session: DebugSession,
        executable: DebugAdapterExecutable | undefined
    ): Promise<DebugAdapterDescriptor> {
        const configuration = session.configuration as LaunchRequestArguments | AttachRequestArguments;

        if (this.experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)) {
            const isAttach = configuration.request === 'attach';
            const port = configuration.port ?? 0;
            // When processId is provided we may have to inject the debugger into the process.
            // This is done by the debug adapter, so we need to start it. The adapter will handle injecting the debugger when it receives the attach request.
            const processId = configuration.processId ?? 0;

            if (isAttach && processId === 0) {
                if (port === 0) {
                    throw new Error('Port or processId must be specified for request type attach');
                } else {
                    return new DebugAdapterServer(port, configuration.host);
                }
            } else {
                const pythonPath = await this.getPythonPath(configuration, session.workspaceFolder);
                // If logToFile is set in the debug config then pass --log-dir <path-to-extension-dir> when launching the debug adapter.
                const logArgs = configuration.logToFile ? ['--log-dir', EXTENSION_ROOT_DIR] : [];
                const ptvsdPathToUse = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'new_ptvsd');

                if (pythonPath.length !== 0) {
                    if (processId) {
                        sendTelemetryEvent(EventName.DEBUGGER_ATTACH_TO_LOCAL_PROCESS);
                    }

                    if (configuration.debugAdapterPath) {
                        return new DebugAdapterExecutable(pythonPath, [configuration.debugAdapterPath, ...logArgs]);
                    }

                    if (await this.useNewPtvsd(pythonPath)) {
                        sendTelemetryEvent(EventName.DEBUG_ADAPTER_USING_WHEELS_PATH, undefined, { usingWheels: true });
                        return new DebugAdapterExecutable(pythonPath, [
                            path.join(ptvsdPathToUse, 'wheels', 'ptvsd', 'adapter'),
                            ...logArgs
                        ]);
                    } else {
                        sendTelemetryEvent(EventName.DEBUG_ADAPTER_USING_WHEELS_PATH, undefined, {
                            usingWheels: false
                        });
                        return new DebugAdapterExecutable(pythonPath, [
                            path.join(ptvsdPathToUse, 'no_wheels', 'ptvsd', 'adapter'),
                            ...logArgs
                        ]);
                    }
                }
            }
        } else {
            this.experimentsManager.sendTelemetryIfInExperiment(DebugAdapterNewPtvsd.control);
        }

        // Use the Node debug adapter (and ptvsd_launcher.py)
        if (executable) {
            return executable;
        }
        // Unlikely scenario.
        throw new Error('Debug Adapter Executable not provided');
    }

    /**
     * Check and return whether the user should and can use the new PTVSD wheels or not.
     *
     * @param {string} pythonPath Path to the python executable used to launch the Python Debug Adapter (result of `this.getPythonPath()`)
     * @returns {Promise<boolean>} Whether the user should and can use the new PTVSD wheels or not.
     * @memberof DebugAdapterDescriptorFactory
     */
    public async useNewPtvsd(pythonPath: string): Promise<boolean> {
        const interpreterInfo = await this.interpreterService.getInterpreterDetails(pythonPath);
        if (!interpreterInfo || !interpreterInfo.version || !interpreterInfo.version.raw.startsWith('3.7')) {
            return false;
        }

        return true;
    }

    public getPtvsdPath(): string {
        return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'new_ptvsd', 'no_wheels', 'ptvsd');
    }

    public getRemotePtvsdArgs(remoteDebugOptions: RemoteDebugOptions): string[] {
        const waitArgs = remoteDebugOptions.waitUntilDebuggerAttaches ? ['--wait'] : [];
        if (this.experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)) {
            return ['--host', remoteDebugOptions.host, '--port', remoteDebugOptions.port.toString(), ...waitArgs];
        }
        return [
            '--default',
            '--host',
            remoteDebugOptions.host,
            '--port',
            remoteDebugOptions.port.toString(),
            ...waitArgs
        ];
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
    private async getPythonPath(
        configuration: LaunchRequestArguments | AttachRequestArguments,
        workspaceFolder?: WorkspaceFolder
    ): Promise<string> {
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
        await this.appShell.showErrorMessage(
            // tslint:disable-next-line: messages-must-be-localized
            'Please install Python or select a Python Interpreter to use the debugger.'
        );
    }
}
