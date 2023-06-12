// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugConfigStrings } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType } from '../../types';

export async function buildFileLaunchDebugConfiguration(
    _input: MultiStepInput<DebugConfigurationState>,
    state: DebugConfigurationState,
): Promise<void> {
    const config: Partial<LaunchRequestArguments> = {
        name: DebugConfigStrings.file.snippet.name,
        type: DebuggerTypeName,
        request: 'launch',
        program: '${file}',
        console: 'integratedTerminal',
        justMyCode: true,
    };
    sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, {
        configurationType: DebugConfigurationType.launchFile,
    });
    Object.assign(state.config, config);
}
