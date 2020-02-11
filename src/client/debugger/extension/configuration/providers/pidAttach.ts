// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { DebugConfigStrings } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { captureTelemetry } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { AttachRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationProvider } from '../../types';

@injectable()
export class PidAttachDebugConfigurationProvider implements IDebugConfigurationProvider {
    @captureTelemetry(
        EventName.DEBUGGER_CONFIGURATION_PROMPTS,
        { configurationType: DebugConfigurationType.pidAttach },
        false
    )
    public async buildConfiguration(_input: MultiStepInput<DebugConfigurationState>, state: DebugConfigurationState) {
        const config: Partial<AttachRequestArguments> = {
            name: DebugConfigStrings.attachPid.snippet.name(),
            type: DebuggerTypeName,
            request: 'attach',
            // tslint:disable-next-line:no-invalid-template-strings
            processId: '${command:pickProcess}'
        };
        Object.assign(state.config, config);
    }
}
