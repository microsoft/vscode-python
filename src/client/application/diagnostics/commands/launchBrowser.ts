// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IBrowserService } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IDiagnostic } from '../types';
import { BaseDiagnostCommand } from './base';

export class LaunchBrowserCommand extends BaseDiagnostCommand {
    constructor(diagnostic: IDiagnostic, private serviceContainer: IServiceContainer, private url: string) {
        super(diagnostic);
    }
    public async invoke(): Promise<void> {
        const browser = this.serviceContainer.get<IBrowserService>(IBrowserService);
        return browser.launch(this.url);
    }
}
