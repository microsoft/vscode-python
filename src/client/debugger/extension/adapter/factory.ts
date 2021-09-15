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
import { traceVerbose } from '../../../common/logger';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService } from '../../../interpreter/contracts';
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
                return new DebugAdapterServer(configuration.connect.port, configuration.connect.host ?? '127.0.0.1');
            } else if (configuration.port !== undefined) {
                return new DebugAdapterServer(configuration.port, configuration.host ?? '127.0.0.1');
            } else if (configuration.listen === undefined && configuration.processId === undefined) {
                throw new Error('"request":"attach" requires either "connect", "listen", or "processId"');
            }
        }

        const pythonPath = await this.getDebugAdapterPython(configuration, session.workspaceFolder);
        if (pythonPath.length !== 0) {
            if (configuration.request === 'attach' && configuration.processId !== undefined) {
                sendTelemetryEvent(EventName.DEBUGGER_ATTACH_TO_LOCAL_PROCESS);
            }

            // "logToFile" is not handled directly by the adapter - instead, we need to pass
            // the corresponding CLI switch when spawning it.
            const logArgs = configuration.logToFile ? ['--log-dir', EXTENSION_ROOT_DIR] : [];

            if (configuration.debugAdapterPath !== undefined) {
                return new DebugAdapterExecutable(pythonPath, [configuration.debugAdapterPath, ...logArgs]);
            }

            const debuggerAdapterPathToUse = path.join(
                EXTENSION_ROOT_DIR,
                'pythonFiles',
                'lib',
                'python',
                'debugpy',
                'adapter',
            );

            sendTelemetryEvent(EventName.DEBUG_ADAPTER_USING_WHEELS_PATH, undefined, { usingWheels: true });
            return new DebugAdapterExecutable(pythonPath, [debuggerAdapterPathToUse, ...logArgs]);
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
    ): Promise<string> {
        if (configuration.debugAdapterPython !== undefined) {
            return configuration.debugAdapterPython;
        } else if (configuration.pythonPath) {
            return configuration.pythonPath;
        }

        const resourceUri = workspaceFolder ? workspaceFolder.uri : undefined;
        const interpreter = await this.interpreterService.getActiveInterpreter(resourceUri);
        if (interpreter) {
            traceVerbose(`Selecting active interpreter as Python Executable for DA '${interpreter.path}'`);
            return interpreter.path;
        }

        await this.interpreterService.hasInterpreters(); // Wait until we know whether we have an interpreter
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
            'Please install Python or select a Python Interpreter to use the debugger.',
        );
    }
}
