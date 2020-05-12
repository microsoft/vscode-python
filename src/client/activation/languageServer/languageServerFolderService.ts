// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerFolderService } from '../common/languageServerFolderService';
import { DotNetLanguageServerFolder, DotNetLanguageServerMinVersionKey } from '../types';

@injectable()
export class DotNetLanguageServerFolderService extends LanguageServerFolderService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, DotNetLanguageServerFolder);
    }

    protected getMinimalLanguageServerVersion(): string {
        return super.getMinimalLanguageServerVersion(DotNetLanguageServerMinVersionKey);
    }
}
