// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as fs from 'fs-extra';
import { WorkspaceFolder } from 'vscode';
import { DebugConfigStrings } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType } from '../../types';

export async function buildFastAPILaunchDebugConfiguration(
    input: MultiStepInput<DebugConfigurationState>,
    state: DebugConfigurationState,
): Promise<void> {
    const application = await getApplicationPath(state.folder);
    let manuallyEnteredAValue: boolean | undefined;
    const config: Partial<LaunchRequestArguments> = {
        name: DebugConfigStrings.fastapi.snippet.name,
        type: DebuggerTypeName,
        request: 'launch',
        module: 'uvicorn',
        args: ['main:app', '--reload'],
        jinja: true,
        justMyCode: true,
    };

    if (!application && config.args) {
        const selectedPath = await input.showInputBox({
            title: DebugConfigStrings.fastapi.enterAppPathOrNamePath.title,
            value: 'main.py',
            prompt: DebugConfigStrings.fastapi.enterAppPathOrNamePath.prompt,
            validate: (value) =>
                Promise.resolve(
                    value && value.trim().length > 0
                        ? undefined
                        : DebugConfigStrings.fastapi.enterAppPathOrNamePath.invalid,
                ),
        });
        if (selectedPath) {
            manuallyEnteredAValue = true;
            config.args[0] = `${path.basename(selectedPath, '.py').replace('/', '.')}:app`;
        }
    }

    sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, {
        configurationType: DebugConfigurationType.launchFastAPI,
        autoDetectedFastAPIMainPyPath: !!application,
        manuallyEnteredAValue,
    });
    Object.assign(state.config, config);
}
export async function getApplicationPath(folder: WorkspaceFolder | undefined): Promise<string | undefined> {
    if (!folder) {
        return undefined;
    }
    const defaultLocationOfManagePy = path.join(folder.uri.fsPath, 'main.py');
    if (await fs.pathExists(defaultLocationOfManagePy)) {
        return 'main.py';
    }
    return undefined;
}
