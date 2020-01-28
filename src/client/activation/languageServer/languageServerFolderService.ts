// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationEnvironment } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerFolderService } from '../common/languageServerFolderService';

@injectable()
export class DotNetLanguageServerFolderService extends LanguageServerFolderService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, 'languageServer');
    }

    protected getMinimalLanguageServerVersion(): string {
        const appEnv = this.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
        return appEnv.packageJson.languageServerVersion as string;
    }
}
