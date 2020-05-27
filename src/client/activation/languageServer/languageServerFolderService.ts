// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationEnvironment } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerFolderService } from '../common/languageServerFolderService';
import { DotNetLanguageServerFolder } from '../types';

// Must match languageServerVersion* keys in package.json
const DotNetLanguageServerMinVersionKey = 'languageServerVersion';

@injectable()
export class DotNetLanguageServerFolderService extends LanguageServerFolderService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, DotNetLanguageServerFolder);
    }

    protected getMinimalLanguageServerVersion(): string {
        let minVersion = '0.0.0';
        try {
            const appEnv = this.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
            if (appEnv) {
                minVersion = appEnv.packageJson[DotNetLanguageServerMinVersionKey] as string;
            }
            // tslint:disable-next-line: no-empty
        } catch {}
        return minVersion;
    }
}
