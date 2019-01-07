// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { DebugConfigurationPrompts, localize } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { sendTelemetryEvent } from '../../../../telemetry';
import { DEBUGGER_CONFIGURATION_PROMPTS } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationProvider } from '../../types';

@injectable()
export class ModuleLaunchDebugConfigurationProvider implements IDebugConfigurationProvider {
    public async buildConfiguration(input: MultiStepInput<DebugConfigurationState>, state: DebugConfigurationState) {
        let manuallyEnteredAValue: boolean | undefined;
        const config: Partial<LaunchRequestArguments> = {
            name: localize('python.snippet.launch.module.label', 'Python: Module')(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'enter-your-module-name'
        };
        const selectedModule = await input.showInputBox({
            title: DebugConfigurationPrompts.moduleEnterModuleTitle(),
            value: config.module || 'enter-your-module-name',
            prompt: DebugConfigurationPrompts.moduleEnterModulePrompt(),
            validate: value => Promise.resolve((value && value.trim().length > 0) ? undefined : DebugConfigurationPrompts.moduleEnterModuleInvalidNameError())
        });
        if (selectedModule) {
            manuallyEnteredAValue = true;
            config.module = selectedModule;
        }

        sendTelemetryEvent(DEBUGGER_CONFIGURATION_PROMPTS, undefined, { configurationType: DebugConfigurationType.launchModule, manuallyEnteredAValue });
        Object.assign(state.config, config);
    }
}
