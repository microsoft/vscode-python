// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { CancellationToken, DebugConfiguration, QuickPickItem, WorkspaceFolder } from 'vscode';
import { DebugConfigurationPrompts } from '../../../common/utils/localize';
import { IMultiStepInput, IMultiStepInputFactory, InputStep, IQuickPickParameters } from '../../../common/utils/multiStepInput';
import { AttachRequestArguments, DebugConfigurationArguments, LaunchRequestArguments } from '../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationService } from '../types';
import { IDebugConfigurationProviderFactory, IDebugConfigurationResolver } from './types';

@injectable()
export class PythonDebugConfigurationService implements IDebugConfigurationService {
    constructor(@inject(IDebugConfigurationResolver) @named('attach') private readonly attachResolver: IDebugConfigurationResolver<AttachRequestArguments>,
        @inject(IDebugConfigurationResolver) @named('launch') private readonly launchResolver: IDebugConfigurationResolver<LaunchRequestArguments>,
        @inject(IDebugConfigurationProviderFactory) private readonly providerFactory: IDebugConfigurationProviderFactory,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory) {
    }
    public async provideDebugConfigurations?(folder: WorkspaceFolder | undefined, token?: CancellationToken): Promise<DebugConfiguration[] | undefined> {
        const config: Partial<DebugConfigurationArguments> = {};
        const state = { config, folder, token };
        const multiStep = this.multiStepFactory.create<DebugConfigurationState>();
        await multiStep.run((input, s) => this.pickDebugConfiguration(input, s), state);
        return state.config as DebugConfiguration[];
    }
    public async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration | undefined> {
        if (debugConfiguration.request === 'attach') {
            return this.attachResolver.resolveDebugConfiguration(folder, debugConfiguration as AttachRequestArguments, token);
        } else {
            return this.launchResolver.resolveDebugConfiguration(folder, debugConfiguration as LaunchRequestArguments, token);
        }
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
