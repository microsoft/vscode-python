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
export class FlaskLaunchDebugConfigurationProvider implements IDebugConfigurationProvider {
    constructor(@inject(IFileSystem) private fs: IFileSystem) {}
    public isSupported(debugConfigurationType: DebugConfigurationType): boolean {
        return debugConfigurationType === DebugConfigurationType.launchFlask;
    }
    public async buildConfiguration(input: MultiStepInput<DebugConfigurationState>, state: DebugConfigurationState) {
        const application = await this.getApplicationPath(state.folder);
        let manuallyEnteredAValue: boolean | undefined;
        const config: Partial<LaunchRequestArguments> = {
            name: DebugConfigStrings.flask.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'flask',
            env: {
                FLASK_APP: application || 'app.py',
                FLASK_ENV: 'development',
                FLASK_DEBUG: '0',
            },
            args: ['run', '--no-debugger', '--no-reload'],
            jinja: true,
        };

        if (!application) {
            const selectedApp = await input.showInputBox({
                title: DebugConfigStrings.flask.enterAppPathOrNamePath.title(),
                value: 'app.py',
                prompt: DebugConfigStrings.flask.enterAppPathOrNamePath.prompt(),
                validate: (value) =>
                    Promise.resolve(
                        value && value.trim().length > 0
                            ? undefined
                            : DebugConfigStrings.flask.enterAppPathOrNamePath.invalid()
                    ),
            });
            if (selectedApp) {
                manuallyEnteredAValue = true;
                config.env!.FLASK_APP = selectedApp;
            }
        }

        sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, {
            configurationType: DebugConfigurationType.launchFlask,
            autoDetectedFlaskAppPyPath: !!application,
            manuallyEnteredAValue,
        });
        Object.assign(state.config, config);
    }
    protected async getApplicationPath(folder: WorkspaceFolder | undefined): Promise<string | undefined> {
        if (!folder) {
            return;
        }
        const defaultLocationOfManagePy = path.join(folder.uri.fsPath, 'app.py');
        if (await this.fs.fileExists(defaultLocationOfManagePy)) {
            return 'app.py';
        }
    }
}
