// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { CancellationToken, DebugConfiguration, DebugConfigurationProvider, WorkspaceFolder } from 'vscode';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';
import { IDebugConfigurationResolver } from './types';

@injectable()
export class PythonDebugConfigurationProvider implements DebugConfigurationProvider {
    constructor(@inject(IDebugConfigurationResolver) @named('attach') private readonly attachResolver: IDebugConfigurationResolver<AttachRequestArguments>,
        @inject(IDebugConfigurationResolver) @named('launch') private readonly launchResolver: IDebugConfigurationResolver<LaunchRequestArguments>) {
    }
    public async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration | undefined> {
        if (debugConfiguration.request === 'attach') {
            return this.attachResolver.resolveDebugConfiguration(folder, debugConfiguration as AttachRequestArguments, token);
        } else {
            return this.launchResolver.resolveDebugConfiguration(folder, debugConfiguration as LaunchRequestArguments, token);
        }    }

}
