// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';

import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, Resource } from '../../common/types';
import { LanguageServerActivatorBase } from '../common/activatorBase';
import { ILanguageServerManager } from '../types';

/**
 * Starts jedi language server manager.
 *
 * @export
 * @class JediLanguageServerActivator
 * @implements {ILanguageServerActivator}
 * @extends {LanguageServerActivatorBase}
 */
@injectable()
export class JediLanguageServerActivator extends LanguageServerActivatorBase {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(
        @inject(ILanguageServerManager) manager: ILanguageServerManager,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IConfigurationService) configurationService: IConfigurationService,
    ) {
        super(manager, workspace, fs, configurationService);
    }

    // eslint-disable-next-line class-methods-use-this
    public async ensureLanguageServerIsAvailable(_resource: Resource): Promise<void> {
        // Nothing to do here. Jedi language server is shipped with the extension
    }
}
