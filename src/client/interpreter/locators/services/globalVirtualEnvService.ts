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
import { BaseVirtualEnvService } from './baseVirtualEnvService';

@injectable()
export class GlobalVirtualEnvService extends BaseVirtualEnvService {
    public constructor(
        @inject(IVirtualEnvironmentsSearchPathProvider) @named('global') globalVirtualEnvPathProvider: IVirtualEnvironmentsSearchPathProvider,
        @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(globalVirtualEnvPathProvider, serviceContainer, 'VirtualEnvService');
    }
}

@injectable()
export class GlobalVirtualEnvironmentsSearchPathProvider implements IVirtualEnvironmentsSearchPathProvider {
    private readonly process: ICurrentProcess;
    private readonly config: IConfigurationService;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.process = serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        this.config = serviceContainer.get<IConfigurationService>(IConfigurationService);
    }

    public getSearchPaths(_resource?: Uri): string[] {
        const homedir = os.homedir();
        const venvFolders = this.config.getSettings(_resource).venvFolders;
        const folders = venvFolders.map(item => path.join(homedir, item));

        // tslint:disable-next-line:no-string-literal
        const pyenvRoot = this.process.env['PYENV_ROOT'];
        if (pyenvRoot) {
            folders.push(pyenvRoot);
            folders.push(path.join(pyenvRoot, 'versions'));
        } else {
            const pyenvVersions = path.join('.pyenv', 'versions');
            if (venvFolders.indexOf('.pyenv') >= 0 && venvFolders.indexOf(pyenvVersions) < 0) {
                folders.push(pyenvVersions);
            }
        }
        return folders;
    }
}
