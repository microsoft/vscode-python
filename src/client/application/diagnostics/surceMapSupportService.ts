// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { ISourceMapSupportService } from './types';

@injectable()
export class SourceMapSupportService implements ISourceMapSupportService {
    constructor(@inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService) {

    }
    public register(): void {
        this.disposables.push(this.commandManager.registerCommand(Commands.Enable_SourceMap_Support, this.enable, this));
    }
    public async enable(): Promise<void> {
        await this.configurationService.updateSetting('diagnostics.sourceMapsEnabled', true, undefined, ConfigurationTarget.Global);
    }
}
