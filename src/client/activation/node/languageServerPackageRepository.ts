// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IWorkspaceService } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { BetaLanguageServerPackageRepository, DailyLanguageServerPackageRepository, StableLanguageServerPackageRepository } from '../common/packageRepository';

@injectable()
export class StableNodeLanguageServerPackageRepository extends StableLanguageServerPackageRepository {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        const config = serviceContainer.get<IWorkspaceService>(IWorkspaceService).getConfiguration('python');
        const packageName = config.get<string>('blobName') || '';
        super(serviceContainer, packageName);
    }
}

@injectable()
export class BetaNodeLanguageServerPackageRepository extends BetaLanguageServerPackageRepository {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        const config = serviceContainer.get<IWorkspaceService>(IWorkspaceService).getConfiguration('python');
        const packageName = config.get<string>('blobName') || '';
        super(serviceContainer, packageName);
    }
}

@injectable()
export class DailyNodeLanguageServerPackageRepository extends DailyLanguageServerPackageRepository {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        const config = serviceContainer.get<IWorkspaceService>(IWorkspaceService).getConfiguration('python');
        const packageName = config.get<string>('blobName') || '';
        super(serviceContainer, packageName);
    }
}
