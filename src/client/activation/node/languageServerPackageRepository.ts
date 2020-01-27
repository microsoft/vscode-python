// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { BetaLanguageServerPackageRepository, DailyLanguageServerPackageRepository, StableLanguageServerPackageRepository } from '../common/packageRepository';

export const languageServerPackageName = 'pyrx';

@injectable()
export class StableNodeLanguageServerPackageRepository extends StableLanguageServerPackageRepository {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, languageServerPackageName);
    }
}

@injectable()
export class BetaNodeLanguageServerPackageRepository extends BetaLanguageServerPackageRepository {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, languageServerPackageName);
    }
}

@injectable()
export class DailyNodeLanguageServerPackageRepository extends DailyLanguageServerPackageRepository {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, languageServerPackageName);
    }
}
