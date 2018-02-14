// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { IPlatformService } from '../../../common/platform/types';
import { IServiceContainer } from '../../../ioc/types';
import { IVirtualEnvironmentsSearchPathProvider } from '../../contracts';
import { BaseVirtualEnvService } from './baseVirtualEnvService';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify = require('untildify');

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
    public constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {

    }
    public getSearchPaths(_resource?: Uri): string[] {
        const platformService = this.serviceContainer.get<IPlatformService>(IPlatformService);
        if (platformService.isWindows) {
            return [];
        } else {
            return ['/Envs', '/.virtualenvs', '/.pyenv', '/.pyenv/versions']
                .map(item => untildify(`~${item}`));
        }
    }
}
