// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { Uri } from 'vscode';
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
    public getSearchPaths(_resource?: Uri): string[] {
        const homedir = os.homedir();
        const folders = ['Envs', '.virtualenvs'].map(item => path.join(homedir, item));

        // tslint:disable-next-line:no-string-literal
        let pyenvRoot = process.env['PYENV_ROOT'];
        pyenvRoot = pyenvRoot ? pyenvRoot : path.join(homedir, '.pyenv');

        folders.push(pyenvRoot);
        folders.push(path.join(pyenvRoot, 'versions'));
        return folders;
    }
}
