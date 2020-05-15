// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { LanguageServerFolderService } from '../common/languageServerFolderService';
import { NodeLanguageServerFolder } from '../types';

@injectable()
export class NodeLanguageServerFolderService extends LanguageServerFolderService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, NodeLanguageServerFolder);
    }

    protected getMinimalLanguageServerVersion(): string {
        return '0.0.1'; // super.getMinimalLanguageServerVersion(NodeLanguageServerMinVersionKey);
    }
}
