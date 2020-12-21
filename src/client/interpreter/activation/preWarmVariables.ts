// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import '../../common/extensions';
import { IInterpreterService } from '../contracts';
import { IEnvironmentActivationService } from './types';

@injectable()
export class PreWarmActivatedEnvironmentVariables implements IExtensionSingleActivationService {
    constructor(
        @inject(IEnvironmentActivationService) private readonly activationService: IEnvironmentActivationService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
    ) {}
    public async activate(): Promise<void> {
        this.interpreterService.onDidChangeInterpreter(() =>
            this.activationService.getActivatedEnvironmentVariables(undefined).ignoreErrors(),
        );
        this.activationService.getActivatedEnvironmentVariables(undefined).ignoreErrors();
    }
}
