// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
// tslint:disable-next-line:no-require-imports
import untildify = require('untildify');
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IConfigurationService } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IVirtualEnvironmentsSearchPathProvider } from '../../contracts';
import { BaseVirtualEnvService } from './baseVirtualEnvService';

@injectable()
export class WorkspaceVirtualEnvService extends BaseVirtualEnvService {
    public constructor(
        @inject(IVirtualEnvironmentsSearchPathProvider) @named('workspace') globalVirtualEnvPathProvider: IVirtualEnvironmentsSearchPathProvider,
        @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(globalVirtualEnvPathProvider, serviceContainer, 'WorkspaceVirtualEnvService', true);
    }
}

@injectable()
export class WorkspaceVirtualEnvironmentsSearchPathProvider implements IVirtualEnvironmentsSearchPathProvider {
    public constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {

    }
    public async getSearchPaths(resource?: Uri): Promise<string[]> {
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const paths: string[] = [];
        const venvPath = configService.getSettings(resource).venvPath;
        if (venvPath) {
            paths.push(untildify(venvPath));
        }
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (Array.isArray(workspaceService.workspaceFolders) && workspaceService.workspaceFolders.length > 0) {
            let wsPath: string | undefined;
            if (resource && workspaceService.workspaceFolders.length > 1) {
                const wkspaceFolder = workspaceService.getWorkspaceFolder(resource);
                if (wkspaceFolder) {
                    wsPath = wkspaceFolder.uri.fsPath;
                }
            } else {
                wsPath = workspaceService.workspaceFolders[0].uri.fsPath;
            }
            if (wsPath) {
                paths.push(wsPath);
                paths.push(path.join(wsPath, '.direnv'));
            }
        }
        return paths;
    }
}
