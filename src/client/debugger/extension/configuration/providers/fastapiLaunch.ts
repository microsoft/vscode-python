// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { WorkspaceFolder } from 'vscode';
import { IFileSystem } from '../../../../common/platform/types';
import { DebugConfigStrings } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationProvider } from '../../types';

@injectable()
export class FastAPILaunchDebugConfigurationProvider implements IDebugConfigurationProvider {
    constructor(@inject(IFileSystem) private fs: IFileSystem) {}
    public isSupported(debugConfigurationType: DebugConfigurationType): boolean {
        return debugConfigurationType === DebugConfigurationType.launchFastAPI;
    }
    public async buildConfiguration(input: MultiStepInput<DebugConfigurationState>, state: DebugConfigurationState) {
        const application = await this.getApplicationPath(state.folder);
        let manuallyEnteredAValue: boolean | undefined;
        const config: Partial<LaunchRequestArguments> = {
            name: DebugConfigStrings.fastapi.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'uvicorn',
            args: ['main:app'],
            jinja: true,
        };

        if (!application) {
            const selectedPath = await input.showInputBox({
                title: DebugConfigStrings.fastapi.enterAppPathOrNamePath.title(),
                value: 'main.py',
                prompt: DebugConfigStrings.fastapi.enterAppPathOrNamePath.prompt(),
                validate: (value) =>
                    Promise.resolve(
                        value && value.trim().length > 0
                            ? undefined
                            : DebugConfigStrings.fastapi.enterAppPathOrNamePath.invalid(),
                    ),
            });
            if (selectedPath) {
                manuallyEnteredAValue = true;
                config.args = [`${path.basename(selectedPath, '.py').replace('/', '.')}:app`];
            }
        }

        sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, {
            configurationType: DebugConfigurationType.launchFastAPI,
            autoDetectedFastAPIMainPyPath: !!application,
            manuallyEnteredAValue,
        });
        Object.assign(state.config, config);
    }
    protected async getApplicationPath(folder: WorkspaceFolder | undefined): Promise<string | undefined> {
        if (!folder) {
            return;
        }
        const defaultLocationOfManagePy = path.join(folder.uri.fsPath, 'main.py');
        if (await this.fs.fileExists(defaultLocationOfManagePy)) {
            return 'main.py';
        }
    }
}
