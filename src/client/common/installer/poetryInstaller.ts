// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { traceError } from '../logger';
import { IFileSystem } from '../platform/types';
import { IProcessServiceFactory } from '../process/types';
import { ExecutionInfo, IConfigurationService } from '../types';
import { isResource } from '../utils/misc';
import { ModuleInstaller } from './moduleInstaller';
import { InterpreterUri } from './types';
export const poetryName = 'poetry';
const poetryFile = 'poetry.lock';

@injectable()
export class PoetryInstaller extends ModuleInstaller {
    public get name(): string {
        return 'poetry';
    }

    public get displayName() {
        return poetryName;
    }
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
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(isResource(resource) ? resource : undefined);
        if (!workspaceFolder) {
            return false;
        }
        if (!(await this.fs.fileExists(path.join(workspaceFolder.uri.fsPath, poetryFile)))) {
            return false;
        }
        return this.isPoetryAvailable(workspaceFolder.uri);
    }
    protected async isPoetryAvailable(workfolder: Uri) {
        try {
            const processService = await this.processFactory.create(workfolder);
            const execPath = this.configurationService.getSettings(workfolder).poetryPath;
            const result = await processService.exec(execPath, ['list'], { cwd: workfolder.fsPath });
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
