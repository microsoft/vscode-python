// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../activation/types';
import '../common/extensions';
import { IDisposableRegistry } from '../common/types';
import { noop } from '../common/utils/misc';
import { IEnvironmentActivationService } from '../interpreter/activation/types';
import { JupyterInterpreterService } from './jupyter/interpreter/jupyterInterpreterService';

@injectable()
export class PreWarmActivatedJupyterEnvironmentVariables implements IExtensionSingleActivationService {
    constructor(
        @inject(IEnvironmentActivationService) private readonly activationService: IEnvironmentActivationService,
        @inject(JupyterInterpreterService) private readonly jupyterInterpreterService: JupyterInterpreterService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    public async activate(): Promise<void> {
        this.disposables.push(this.jupyterInterpreterService.onDidChangeInterpreter(() => this.preWarmInterpreterVariables().catch(noop)));
        this.preWarmInterpreterVariables().ignoreErrors();
    }

    private async preWarmInterpreterVariables() {
        const interpreter = await this.jupyterInterpreterService.getSelectedInterpreter();
        if (!interpreter) {
            return;
        }
        this.activationService.getActivatedEnvironmentVariables(undefined, interpreter).ignoreErrors();
    }
}
