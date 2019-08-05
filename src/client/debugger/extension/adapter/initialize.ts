// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../../../activation/types';
import { inject } from 'inversify';
import { IDebugService } from '../../../common/application/types';

export class DebugAdapterActivator implements IExtensionSingleActivationService {
    constructor(@inject(IDebugService) private readonly debugService: IDebugService){}
    public async activate(): Promise<void> {

    }
}
