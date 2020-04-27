// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../../../activation/types';
import { ICommandManager } from '../../../../common/application/types';
import { Commands } from '../../../../common/constants';
import { IDisposable, IDisposableRegistry } from '../../../../common/types';
import { IInterpreterDisplay } from '../../../../interpreter/contracts';

@injectable()
export class InterpreterPathCommand implements IExtensionSingleActivationService {
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IInterpreterDisplay) private readonly interpreterDisplay: IInterpreterDisplay,
        @inject(IDisposableRegistry) private readonly disposables: IDisposable[]
    ) {}

    public async activate() {
        this.disposables.push(
            this.commandManager.registerCommand(
                Commands.GetSelectedInterpreterPath,
                () => this.interpreterDisplay.interpreterPath
            )
        );
    }
}
