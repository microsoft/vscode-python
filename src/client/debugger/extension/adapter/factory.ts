// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { parse } from 'semver';
import { promisify } from 'util';
import { DebugAdapterDescriptor, DebugAdapterExecutable, DebugSession, WorkspaceFolder } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { PVSC_EXTENSION_ID } from '../../../common/constants';
import { DebugAdapterNewPtvsd } from '../../../common/experimentGroups';
import { traceVerbose } from '../../../common/logger';
import { IPythonExecutionFactory } from '../../../common/process/types';
import { IExperimentsManager, IExtensions, IPersistentStateFactory } from '../../../common/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { IInterpreterService } from '../../../interpreter/contracts';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';
import { DebugAdapterPtvsdPathInfo, IDebugAdapterDescriptorFactory } from '../types';

export const ptvsdPathStorageKey = 'PTVSD_PATH_STORAGE_KEY';

@injectable()
export class DebugAdapterDescriptorFactory implements IDebugAdapterDescriptorFactory {
    constructor(
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager,
        @inject(IPythonExecutionFactory) private readonly executionFactory: IPythonExecutionFactory,
        @inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory,
        @inject(IExtensions) private readonly extensions: IExtensions
    ) {}
    public async createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable | undefined): Promise<DebugAdapterDescriptor> {
        const configuration = session.configuration as (LaunchRequestArguments | AttachRequestArguments);
        const pythonPath = await this.getPythonPath(configuration, session.workspaceFolder);

        if (await this.useNewPtvsd(pythonPath)) {
            // If logToFile is set in the debug config then pass --log-dir <path-to-extension-dir> when launching the debug adapter.
            const logArgs = configuration.logToFile ? ['--log-dir', EXTENSION_ROOT_DIR] : [];
            const ptvsdPathToUse = await this.getPtvsdPath(pythonPath);
            return new DebugAdapterExecutable(`${pythonPath}`, [ptvsdPathToUse, ...logArgs]);
        }

        // Use the Node debug adapter (and ptvsd_launcher.py)
        if (executable) {
            return executable;
        }
        // Unlikely scenario.
        throw new Error('Debug Adapter Executable not provided');
    }

    /**
     * Check and return whether the user is in the PTVSD wheels experiment or not.
     *
     * @param {string} pythonPath Path to the python executable used to launch the Python Debug Adapter (result of `this.getPythonPath()`)
     * @returns {Promise<boolean>} Whether the user is in the experiment or not.
     * @memberof DebugAdapterDescriptorFactory
     */
    public async useNewPtvsd(pythonPath: string): Promise<boolean> {
        if (!this.experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)) {
            return false;
        }

        const interpreterInfo = await this.interpreterService.getInterpreterDetails(pythonPath);
        if (!interpreterInfo || !interpreterInfo.version || !interpreterInfo.version.raw.startsWith('3.7')) {
            return false;
        }

        return true;
    }

    public async getPtvsdPath(pythonPath: string): Promise<string> {
        let ptvsdPathToUse: string;

        try {
            ptvsdPathToUse = await this.getPtvsdFolder(pythonPath);
        } catch {
            ptvsdPathToUse = path.join(EXTENSION_ROOT_DIR, 'pythonFiles');
        }

        return path.join(ptvsdPathToUse, 'ptvsd', 'adapter');
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
        await this.appShell.showErrorMessage('Please install Python or select a Python Interpereter to use the debugger.');
    }

    /**
     * Return the folder name for the bundled PTVSD wheel compatible with the new debug adapter.
     * Use `ptvsd_folder_name.py` to compute the experimental PTVSD folder name in 2 cases:
     * - It has never been computed before;
     * - The extension number has changed since the last time it was cached.
     *
     * Return a cached path otherwise, since we pin the PTVSD version with each extension release,
     * and other factors on folder selection (like host platform) won't change.
     *
     * @private
     * @param {string} pythonPath Path to the python executable used to launch the Python Debug Adapter (result of `this.getPythonPath()`)
     * @returns {Promise<string>} Path to the PTVSD version to use in the debug adapter.
     * @memberof DebugAdapterDescriptorFactory
     */
    private async getPtvsdFolder(pythonPath: string): Promise<string> {
        const persistentState = this.stateFactory.createGlobalPersistentState<DebugAdapterPtvsdPathInfo | undefined>(ptvsdPathStorageKey, undefined);
        const extension = this.extensions.getExtension(PVSC_EXTENSION_ID)!;
        const version = parse(extension.packageJSON.version)!;

        if (persistentState.value && version.raw === persistentState.value.extensionVersion) {
            const cachedPath = persistentState.value.ptvsdPath;
            const access = promisify(fs.access);
            try {
                await access(cachedPath, fs.constants.F_OK);
                return cachedPath;
            } catch (err) {
                // The path to the cached folder didn't exist (ptvsd requirements updated during development), so run the script again.
            }
        }

        // The ptvsd path wasn't cached, so run the script and cache it.
        const pathToScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'ptvsd_folder_name.py');
        const pythonProcess = await this.executionFactory.create({ pythonPath });
        const executionResult = await pythonProcess.exec([pathToScript], {});
        const pathToPtvsd = executionResult.stdout.trim();

        await persistentState.updateValue({ extensionVersion: version.raw, ptvsdPath: pathToPtvsd });

        return pathToPtvsd;
    }
}
