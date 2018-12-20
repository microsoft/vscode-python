// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { localize } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, IDebugConfigurationProvider } from '../../types';

@injectable()
export class FileLaunchDebugConfigurationProvider implements IDebugConfigurationProvider {
    public async buildConfiguration(_input: MultiStepInput<DebugConfigurationState>, state: DebugConfigurationState) {
        const config: Partial<LaunchRequestArguments> = {
            name: localize('python.snippet.launch.standard.label', 'Python: Current File')(),
            type: DebuggerTypeName,
            request: 'launch',
            // tslint:disable-next-line:no-invalid-template-strings
            program: '${file}',
            console: 'integratedTerminal'
        };
        Object.assign(state.config, config);
    }
}
