// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationEnvironment, IWorkspaceService } from '../../common/application/types';
import { IPlatformService } from '../../common/platform/types';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerPackageService } from '../common/languageServerPackageService';

@injectable()
export class NodeLanguageServerPackageService extends LanguageServerPackageService {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IApplicationEnvironment) appEnv: IApplicationEnvironment,
        @inject(IPlatformService) platform: IPlatformService
    ) {
        super(serviceContainer, appEnv, platform);
    }

    public getNugetPackageName(): string {
        const config = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService).getConfiguration('python');
        return config.get<string>('packageName') || '';
    }
}
