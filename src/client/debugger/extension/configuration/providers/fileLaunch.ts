// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { DebugConfigStrings } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { captureTelemetry } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationProvider } from '../../types';

@injectable()
export class FileLaunchDebugConfigurationProvider implements IDebugConfigurationProvider {
    @captureTelemetry(
        EventName.DEBUGGER_CONFIGURATION_PROMPTS,
        { configurationType: DebugConfigurationType.launchFile },
        false
    )
    public async buildConfiguration(_input: MultiStepInput<DebugConfigurationState>, state: DebugConfigurationState) {
        const config: Partial<LaunchRequestArguments> = {
            name: DebugConfigStrings.file.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            // tslint:disable-next-line:no-invalid-template-strings
            program: '${file}',
            console: 'integratedTerminal'
        };
        Object.assign(state.config, config);
    }
}
