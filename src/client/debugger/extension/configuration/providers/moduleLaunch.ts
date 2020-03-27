// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { DebugConfigStrings } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationProvider } from '../../types';

@injectable()
export class ModuleLaunchDebugConfigurationProvider implements IDebugConfigurationProvider {
    public async buildConfiguration(input: MultiStepInput<DebugConfigurationState>, state: DebugConfigurationState) {
        let manuallyEnteredAValue: boolean | undefined;
        const config: Partial<LaunchRequestArguments> = {
            name: DebugConfigStrings.module.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: DebugConfigStrings.module.snippet.default(),
        };
        const selectedModule = await input.showInputBox({
            title: DebugConfigStrings.module.enterModule.title(),
            value: config.module || DebugConfigStrings.module.enterModule.default(),
            prompt: DebugConfigStrings.module.enterModule.prompt(),
            validate: (value) =>
                Promise.resolve(
                    value && value.trim().length > 0 ? undefined : DebugConfigStrings.module.enterModule.invalid()
                ),
        });
        if (selectedModule) {
            manuallyEnteredAValue = true;
            config.module = selectedModule;
        }

        sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, {
            configurationType: DebugConfigurationType.launchModule,
            manuallyEnteredAValue,
        });
        Object.assign(state.config, config);
    }
}
