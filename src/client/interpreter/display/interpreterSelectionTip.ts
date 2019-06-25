// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionActivationService } from '../../activation/types';
import { IApplicationShell } from '../../common/application/types';
import { IPersistentState, IPersistentStateFactory, Resource } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';
import { Common, Interpreters } from '../../common/utils/localize';

@injectable()
export class InterpreterSelectionTip implements IExtensionActivationService {
    private readonly storage: IPersistentState<boolean>;
    private displayedInSession: boolean = false;
    constructor(@inject(IApplicationShell) private readonly shell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly factory: IPersistentStateFactory) {
        this.storage = this.factory.createGlobalPersistentState('InterpreterSelectionTip', false);
    }
    public async activate(_resource: Resource): Promise<void> {
        if (this.storage.value || this.displayedInSession) {
            return;
        }
        this.displayedInSession = true;
        this.showTip().ignoreErrors();
    }
    @swallowExceptions('Failed to display tip')
    private async showTip() {
        const selection = await this.shell.showInformationMessage(Interpreters.selectInterpreterTip(), Common.gotIt());
        if (selection !== Common.gotIt()) {
            return;
        }
        await this.storage.updateValue(true);
    }
}
