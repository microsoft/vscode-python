// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../../../activation/types';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../../../common/application/types';
import { IDisposableRegistry } from '../../../../common/types';
import { IDebugConfigurationService } from '../../types';
import { LaunchJsonUpdaterServiceHelper } from './updaterServiceHelper';

@injectable()
export class LaunchJsonUpdaterService implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IDebugConfigurationService) private readonly configurationProvider: IDebugConfigurationService,
    ) {}

    public async activate(): Promise<void> {
        const handler = new LaunchJsonUpdaterServiceHelper(
            this.commandManager,
            this.workspace,
            this.documentManager,
            this.configurationProvider,
        );
        this.disposableRegistry.push(
            this.commandManager.registerCommand(
                'python.SelectAndInsertDebugConfiguration',
                handler.selectAndInsertDebugConfig,
                handler,
            ),
        );
    }
}
