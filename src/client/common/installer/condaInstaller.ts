// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import 'reflect-metadata';
import { Uri } from 'vscode';
import { ICondaLocatorService, IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE, InterpreterType, PythonInterpreter } from '../../interpreter/contracts';
import { CONDA_RELATIVE_PY_PATH } from '../../interpreter/locators/services/conda';
import { IServiceContainer } from '../../ioc/types';
import { PythonSettings } from '../configSettings';
import { IProcessService, IPythonExecutionFactory } from '../process/types';
import { ExecutionInfo } from '../types';
import { ModuleInstaller } from './moduleInstaller';
import { IModuleInstaller } from './types';

@injectable()
export class CondaInstaller extends ModuleInstaller implements IModuleInstaller {
    private isCondaAvailable: boolean | undefined;
    public get displayName() {
        return 'Conda';
    }
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public async isSupported(resource?: Uri): Promise<boolean> {
        if (typeof this.isCondaAvailable === 'boolean') {
            return this.isCondaAvailable!;
        }
        const processService = this.serviceContainer.get<IProcessService>(IProcessService);
        const condaLocator = this.serviceContainer.get<ICondaLocatorService>(ICondaLocatorService);
        const available = condaLocator.getCondaFile()
            .then(condaFile => processService.exec(condaFile, ['--version'], {}))
            .then(() => this.isCondaAvailable = true)
            .catch(() => this.isCondaAvailable = false);

        if (!available) {
            return false;
        }

        // Now we need to check if the current environment is a conda environment or not.
        const info = await this.getCurrentInterpreterInfo(resource);
        return info.isConda === true;
    }
    protected async getExecutionInfo(moduleName: string, resource?: Uri): Promise<ExecutionInfo> {
        const condaLocator = this.serviceContainer.get<ICondaLocatorService>(ICondaLocatorService);
        const condaFile = await condaLocator.getCondaFile();

        const info = await this.getCurrentInterpreterInfo(resource);
        const args = ['install'];

        if (info.envName) {
            // If we have the name of the conda environment, then use that.
            args.push('--name');
            args.push(info.envName!);
        } else {
            // Else provide the full path to the environment path.
            args.push('--prefix');
            args.push(info.envPath);
        }
        return {
            args,
            execPath: condaFile,
            moduleName: ''
        };
    }
    private async getCurrentPythonPath(resource?: Uri): Promise<string> {
        const pythonPath = PythonSettings.getInstance(resource).pythonPath;
        if (path.basename(pythonPath) === pythonPath) {
            const pythonProc = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create(resource);
            const result = await pythonProc.exec(['-c', 'import sys;print(sys.executable)'], { throwOnStdErr: true });
            const stdout = result.stdout.trim();
            return stdout.length === 0 ? pythonPath : stdout;
        } else {
            return pythonPath;
        }
    }
    private async getCurrentInterpreterInfo(resource?: Uri) {
        // Use this service, though it returns everything it is cached.
        const interpreterLocator = this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
        const interpretersPromise = interpreterLocator.getInterpreters(resource);
        const pythonPathPromise = this.getCurrentPythonPath(resource);
        const [interpreters, currentPythonPath] = await Promise.all([interpretersPromise, pythonPathPromise]);

        // Check if we have the info about the current python path.
        const info = interpreters.find(item => path.dirname(item.path) === path.dirname(currentPythonPath));
        const pythonPath = info ? info!.path : undefined;
        // tslint:disable-next-line:prefer-array-literal
        const pathsToRemove = new Array(CONDA_RELATIVE_PY_PATH.length).fill('..') as string[];
        const envPath = path.join(path.dirname(currentPythonPath), ...pathsToRemove);
        return {
            isConda: info && info!.type === InterpreterType.Conda,
            pythonPath: currentPythonPath,
            envPath,
            envName: info ? info!.envName : undefined
        };
    }
}
