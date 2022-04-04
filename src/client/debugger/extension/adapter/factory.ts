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
    WorkspaceFolder,
} from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService } from '../../../interpreter/contracts';
import { traceLog, traceVerbose } from '../../../logging';
import { PythonEnvironment } from '../../../pythonEnvironments/info';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';
import { IDebugAdapterDescriptorFactory } from '../types';

@injectable()
export class DebugAdapterDescriptorFactory implements IDebugAdapterDescriptorFactory {
    constructor(
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
    ) {}

    public async createDebugAdapterDescriptor(
        session: DebugSession,
        _executable: DebugAdapterExecutable | undefined,
    ): Promise<DebugAdapterDescriptor> {
        const configuration = session.configuration as LaunchRequestArguments | AttachRequestArguments;

        // There are four distinct scenarios here:
        //
        // 1. "launch";
        // 2. "attach" with "processId";
        // 3. "attach" with "listen";
        // 4. "attach" with "connect" (or legacy "host"/"port");
        //
        // For the first three, we want to spawn the debug adapter directly.
        // For the last one, the adapter is already listening on the specified socket.
        // When "debugServer" is used, the standard adapter factory takes care of it - no need to check here.

        if (configuration.request === 'attach') {
            if (configuration.connect !== undefined) {
                traceLog(
                    `Connecting to DAP Server at:  ${configuration.connect.host ?? '127.0.0.1'}:${
                        configuration.connect.port
                    }`,
                );
                return new DebugAdapterServer(configuration.connect.port, configuration.connect.host ?? '127.0.0.1');
            } else if (configuration.port !== undefined) {
                traceLog(`Connecting to DAP Server at:  ${configuration.host ?? '127.0.0.1'}:${configuration.port}`);
                return new DebugAdapterServer(configuration.port, configuration.host ?? '127.0.0.1');
            } else if (configuration.listen === undefined && configuration.processId === undefined) {
                throw new Error('"request":"attach" requires either "connect", "listen", or "processId"');
            }
        }

        const command = await this.getDebugAdapterPython(configuration, session.workspaceFolder);
        if (command.length !== 0) {
            if (configuration.request === 'attach' && configuration.processId !== undefined) {
                sendTelemetryEvent(EventName.DEBUGGER_ATTACH_TO_LOCAL_PROCESS);
            }

            const executable = command.shift() ?? 'python';

            // "logToFile" is not handled directly by the adapter - instead, we need to pass
            // the corresponding CLI switch when spawning it.
            const logArgs = configuration.logToFile ? ['--log-dir', EXTENSION_ROOT_DIR] : [];

            if (configuration.debugAdapterPath !== undefined) {
                const args = command.concat([configuration.debugAdapterPath, ...logArgs]);
                traceLog(`DAP Server launched with command: ${executable} ${args.join(' ')}`);
                return new DebugAdapterExecutable(executable, args);
            }

            const debuggerAdapterPathToUse = path.join(
                EXTENSION_ROOT_DIR,
                'pythonFiles',
                'lib',
                'python',
                'debugpy',
                'adapter',
            );

            const args = command.concat([debuggerAdapterPathToUse, ...logArgs]);
            traceLog(`DAP Server launched with command: ${executable} ${args.join(' ')}`);
            sendTelemetryEvent(EventName.DEBUG_ADAPTER_USING_WHEELS_PATH, undefined, { usingWheels: true });
            return new DebugAdapterExecutable(executable, args);
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
     * @returns {Promise<string>} Path to the python interpreter for this workspace.
     * @memberof DebugAdapterDescriptorFactory
     */
    private async getDebugAdapterPython(
        configuration: LaunchRequestArguments | AttachRequestArguments,
        workspaceFolder?: WorkspaceFolder,
    ): Promise<string[]> {
        if (configuration.debugAdapterPython !== undefined) {
            return this.getExecutableCommand(
                await this.interpreterService.getInterpreterDetails(configuration.debugAdapterPython),
            );
        } else if (configuration.pythonPath) {
            return this.getExecutableCommand(
                await this.interpreterService.getInterpreterDetails(configuration.pythonPath),
            );
        }

        const resourceUri = workspaceFolder ? workspaceFolder.uri : undefined;
        const interpreter = await this.interpreterService.getActiveInterpreter(resourceUri);
        if (interpreter) {
            traceVerbose(`Selecting active interpreter as Python Executable for DA '${interpreter.path}'`);
            return this.getExecutableCommand(interpreter);
        }

        await this.interpreterService.hasInterpreters(); // Wait until we know whether we have an interpreter
        const interpreters = await this.interpreterService.getInterpreters(resourceUri);
        if (interpreters.length === 0) {
            this.notifySelectInterpreter().ignoreErrors();
            return [];
        }

        traceVerbose(`Picking first available interpreter to launch the DA '${interpreters[0].path}'`);
        return this.getExecutableCommand(interpreters[0]);
    }

    private async getExecutableCommand(interpreter: PythonEnvironment | undefined): Promise<string[]> {
        if (interpreter) {
            return interpreter.path.length > 0 ? [interpreter.path] : [];
        }
        return [];
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
            'Please install Python or select a Python Interpreter to use the debugger.',
        );
    }
}
