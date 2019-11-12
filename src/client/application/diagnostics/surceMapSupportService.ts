// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { Diagnostics } from '../../common/utils/localize';
import { ISourceMapSupportService } from './types';

@injectable()
export class SourceMapSupportService implements ISourceMapSupportService {
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IApplicationShell) private readonly shell: IApplicationShell
    ) {}
    public register(): void {
        this.disposables.push(this.commandManager.registerCommand(Commands.Enable_SourceMap_Support, this.onEnable, this));
    }
    public async enable(): Promise<void> {
        await this.configurationService.updateSetting('diagnostics.sourceMapsEnabled', true, undefined, ConfigurationTarget.Global);
        await this.commandManager.executeCommand('workbench.action.reloadWindow');
    }
    protected async onEnable(): Promise<void> {
        const enableSourceMapsAndReloadVSC = Diagnostics.enableSourceMapsAndReloadVSC();
        const selection = await this.shell.showWarningMessage(Diagnostics.warnBeforeEnablingSourceMaps(), enableSourceMapsAndReloadVSC);
        if (selection === enableSourceMapsAndReloadVSC) {
            await this.enable();
        }
    }
}
