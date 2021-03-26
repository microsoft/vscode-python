// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { isPoetryEnvironmentRelatedToFolder } from '../../pythonEnvironments/discovery/locators/services/poetry';
import { EnvironmentType } from '../../pythonEnvironments/info';
import { IWorkspaceService } from '../application/types';
import { inDiscoveryExperiment } from '../experiments/helpers';
import { traceError } from '../logger';
import { IFileSystem } from '../platform/types';
import { IProcessServiceFactory } from '../process/types';
import { ExecutionInfo, IConfigurationService, IExperimentService } from '../types';
import { isResource } from '../utils/misc';
import { ModuleInstaller } from './moduleInstaller';
import { InterpreterUri } from './types';

export const poetryName = 'poetry';
const poetryFile = 'poetry.lock';

@injectable()
export class PoetryInstaller extends ModuleInstaller {
    // eslint-disable-next-line class-methods-use-this
    public get name(): string {
        return 'poetry';
    }

    // eslint-disable-next-line class-methods-use-this
    public get displayName(): string {
        return poetryName;
    }

    // eslint-disable-next-line class-methods-use-this
    public get priority(): number {
        return 10;
    }

    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IProcessServiceFactory) private readonly processFactory: IProcessServiceFactory,
    ) {
        super(serviceContainer);
    }

    public async isSupported(resource?: InterpreterUri): Promise<boolean> {
        if (!resource) {
            return false;
        }
        const experimentService = this.serviceContainer.get<IExperimentService>(IExperimentService);
        if (await inDiscoveryExperiment(experimentService)) {
            if (!isResource(resource)) {
                return false;
            }
            const interpreter = await this.serviceContainer
                .get<IInterpreterService>(IInterpreterService)
                .getActiveInterpreter(resource);
            const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
            if (!interpreter || !workspaceFolder || interpreter.envType !== EnvironmentType.Poetry) {
                return false;
            }
            // Install using poetry CLI only if the active poetry environment is related to the current folder.
            return isPoetryEnvironmentRelatedToFolder(
                interpreter.path,
                workspaceFolder.uri.fsPath,
                this.configurationService.getSettings(resource).poetryPath,
            );
        }
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(isResource(resource) ? resource : undefined);
        if (!workspaceFolder) {
            return false;
        }
        if (!(await this.fs.fileExists(path.join(workspaceFolder.uri.fsPath, poetryFile)))) {
            return false;
        }
        return this.isPoetryAvailable(workspaceFolder.uri);
    }

    protected async isPoetryAvailable(workfolder: Uri): Promise<boolean> {
        try {
            const processService = await this.processFactory.create(workfolder);
            const execPath = this.configurationService.getSettings(workfolder).poetryPath;
            const result = await processService.shellExec(`${execPath} env list`, { cwd: workfolder.fsPath });
            return result && (result.stderr || '').trim().length === 0;
        } catch (error) {
            traceError(`${poetryFile} exists but Poetry not found`, error);
            return false;
        }
    }

    protected async getExecutionInfo(moduleName: string, resource?: InterpreterUri): Promise<ExecutionInfo> {
        const execPath = this.configurationService.getSettings(isResource(resource) ? resource : undefined).poetryPath;
        const args = ['add', '--dev', moduleName];
        if (moduleName === 'black') {
            args.push('--allow-prereleases');
        }
        return {
            args,
            execPath,
        };
    }
}
