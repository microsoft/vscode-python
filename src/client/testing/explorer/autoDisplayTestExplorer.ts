// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionActivationService } from '../../activation/types';
import { ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { IDisposable, IDisposableRegistry, Resource } from '../../common/types';
import { CommandSource } from '../common/constants';
import { Tests } from '../common/types';
import { ITestManagementService } from '../types';

@injectable()
export class AutoDisplayTestExplorer implements IExtensionActivationService {
    private readonly disposables: IDisposable[] = [];
    private activated = false;
    constructor(
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(ITestManagementService) private readonly managementService: ITestManagementService
    ) {
        disposableRegistry.push(this);
    }

    public async activate(_resource: Resource): Promise<void> {
        if (this.activated) {
            return;
        }
        this.managementService.onTestsDiscovered(this.onTestsDiscovered, this, this.disposables);
        this.activated = true;
    }
    /**
     * If tests have been automatically discovered, then display the test explorer.
     *
     * @param {{ triggerSource: CommandSource; tests?: Tests }} eventArgs
     * @memberof AutoDisplayTestExplorer
     */
    public async onTestsDiscovered(eventArgs: { triggerSource: CommandSource; tests?: Tests }): Promise<void> {
        if (eventArgs.triggerSource === CommandSource.auto) {
            await this.cmdManager.executeCommand(Commands.Test_Display_Test_Explorer);
        }
    }
    public dispose(): void {
        this.disposables.forEach(item => item.dispose());
    }
}
