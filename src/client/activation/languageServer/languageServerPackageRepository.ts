// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { BetaLanguageServerPackageRepository, DailyLanguageServerPackageRepository, StableLanguageServerPackageRepository } from '../common/packageRepository';

const languageServerPackageName = 'python-language-server';

@injectable()
export class StableDotNetLanguageServerPackageRepository extends StableLanguageServerPackageRepository {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, languageServerPackageName);
    }
}

@injectable()
export class BetaDotNetLanguageServerPackageRepository extends BetaLanguageServerPackageRepository {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, languageServerPackageName);
    }
}

@injectable()
export class DailyDotNetLanguageServerPackageRepository extends DailyLanguageServerPackageRepository {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, languageServerPackageName);
    }
}
