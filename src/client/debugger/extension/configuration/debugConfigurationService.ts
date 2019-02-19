// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { CancellationToken, DebugConfiguration, QuickPickItem, WorkspaceFolder } from 'vscode';
import { IFileSystem } from '../../../common/platform/types';
import { DebugConfigurationPrompts } from '../../../common/utils/localize';
import { IMultiStepInput, InputStep, IQuickPickParameters } from '../../../common/utils/multiStepInput';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { AttachRequestArguments, DebugConfigurationArguments, LaunchRequestArguments } from '../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationService } from '../types';
import { IDebugConfigurationProviderFactory, IDebugConfigurationResolver } from './types';

@injectable()
export class PythonDebugConfigurationService implements IDebugConfigurationService {
    constructor(@inject(IDebugConfigurationResolver) @named('attach') private readonly attachResolver: IDebugConfigurationResolver<AttachRequestArguments>,
        @inject(IDebugConfigurationResolver) @named('launch') private readonly launchResolver: IDebugConfigurationResolver<LaunchRequestArguments>,
        @inject(IDebugConfigurationProviderFactory) private readonly providerFactory: IDebugConfigurationProviderFactory,
        // tslint:disable-next-line:no-unused-variable
        // @inject(IMultiStepInputFactory) private readonly _multiStepFactory: IMultiStepInputFactory,
        @inject(IFileSystem) private readonly fs: IFileSystem) {
    }
    public async provideDebugConfigurations(folder: WorkspaceFolder | undefined, token?: CancellationToken): Promise<DebugConfiguration[] | undefined> {
        const config: Partial<DebugConfigurationArguments> = {};
        const state = { config, folder, token };

        // Disabled until configuration issues are addressed by VS Code. See #4007
        // const multiStep = this.multiStepFactory.create<DebugConfigurationState>();
        // await multiStep.run((input, s) => this.pickDebugConfiguration(input, s), state);

        if (Object.keys(state.config).length === 0) {
            return this.getDefaultDebugConfig();
        } else {
            return [state.config as DebugConfiguration];
        }
    }
    public async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration | undefined> {
        if (debugConfiguration.request === 'attach') {
            return this.attachResolver.resolveDebugConfiguration(folder, debugConfiguration as AttachRequestArguments, token);
        } else if (debugConfiguration.request === 'test') {
            throw Error('Please use the command \'Python: Debug Unit Tests\'');
        } else {
            return this.launchResolver.resolveDebugConfiguration(folder, debugConfiguration as LaunchRequestArguments, token);
        }
    }
    protected async getDefaultDebugConfig(): Promise<DebugConfiguration[]> {
        sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, { configurationType: DebugConfigurationType.default });
        const jsFilePath = path.join(EXTENSION_ROOT_DIR, 'resources', 'default.launch.json');
        const jsonStr = await this.fs.readFile(jsFilePath);
        return JSON.parse(jsonStr) as DebugConfiguration[];
    }
    protected async  pickDebugConfiguration(input: IMultiStepInput<DebugConfigurationState>, state: DebugConfigurationState): Promise<InputStep<DebugConfigurationState> | void> {
        type DebugConfigurationQuickPickItem = QuickPickItem & { type: DebugConfigurationType };
        const items: DebugConfigurationQuickPickItem[] = [
            { label: DebugConfigurationPrompts.debugFileConfigurationLabel(), type: DebugConfigurationType.launchFile, description: DebugConfigurationPrompts.debugFileConfigurationDescription() },
            { label: DebugConfigurationPrompts.debugModuleConfigurationLabel(), type: DebugConfigurationType.launchModule, description: DebugConfigurationPrompts.debugModuleConfigurationDescription() },
            { label: DebugConfigurationPrompts.remoteAttachConfigurationLabel(), type: DebugConfigurationType.remoteAttach, description: DebugConfigurationPrompts.remoteAttachConfigurationDescription() },
            { label: DebugConfigurationPrompts.debugDjangoConfigurationLabel(), type: DebugConfigurationType.launchDjango, description: DebugConfigurationPrompts.debugDjangoConfigurationDescription() },
            { label: DebugConfigurationPrompts.debugFlaskConfigurationLabel(), type: DebugConfigurationType.launchFlask, description: DebugConfigurationPrompts.debugFlaskConfigurationDescription() },
            { label: DebugConfigurationPrompts.debugPyramidConfigurationLabel(), type: DebugConfigurationType.launchPyramid, description: DebugConfigurationPrompts.debugPyramidConfigurationDescription() }
        ];
        state.config = {};
        const pick = await input.showQuickPick<DebugConfigurationQuickPickItem, IQuickPickParameters<DebugConfigurationQuickPickItem>>({
            title: DebugConfigurationPrompts.selectConfigurationTitle(),
            placeholder: DebugConfigurationPrompts.selectConfigurationPlaceholder(),
            activeItem: items[0],
            items: items
        });
        if (pick) {
            const provider = this.providerFactory.create(pick.type);
            return provider.buildConfiguration.bind(provider);
        }
    }
}
