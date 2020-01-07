// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { Uri } from 'vscode';
import { IConfigurationService, ICurrentProcess } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IVirtualEnvironmentsSearchPathProvider } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';
import { BaseVirtualEnvService } from './baseVirtualEnvService';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

@injectable()
export class GlobalVirtualEnvService extends BaseVirtualEnvService {
    public constructor(
        @inject(IVirtualEnvironmentsSearchPathProvider) @named('global') globalVirtualEnvPathProvider: IVirtualEnvironmentsSearchPathProvider,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        super(globalVirtualEnvPathProvider, serviceContainer, 'VirtualEnvService');
    }
}

@injectable()
export class GlobalVirtualEnvironmentsSearchPathProvider implements IVirtualEnvironmentsSearchPathProvider {
    private readonly config: IConfigurationService;
    private readonly currentProcess: ICurrentProcess;
    private readonly virtualEnvMgr: IVirtualEnvironmentManager;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.config = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.virtualEnvMgr = serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
        this.currentProcess = serviceContainer.get<ICurrentProcess>(ICurrentProcess);
    }

    public async getSearchPaths(resource?: Uri): Promise<string[]> {
        const homedir = os.homedir();
        const venvFolders = ['envs', '.pyenv', '.direnv', '.virtualenvs', ...this.config.getSettings(resource).venvFolders];
        const folders = [...new Set(venvFolders.map(item => path.join(homedir, item)))];

        // Add support for the WORKON_HOME environment variable used by pipenv and virtualenvwrapper.
        const workonHomePath = this.currentProcess.env.WORKON_HOME;
        if (workonHomePath) {
            folders.push(untildify(workonHomePath));
        }

        // tslint:disable-next-line:no-string-literal
        const pyenvRoot = await this.virtualEnvMgr.getPyEnvRoot(resource);
        if (pyenvRoot) {
            folders.push(pyenvRoot);
            folders.push(path.join(pyenvRoot, 'versions'));
        }
        return folders;
    }
}
