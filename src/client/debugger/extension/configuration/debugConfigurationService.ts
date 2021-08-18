// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { cloneDeep } from 'lodash';
import { CancellationToken, DebugConfiguration, QuickPickItem, WorkspaceFolder } from 'vscode';
import { CacheDebugConfig } from '../../../common/experiments/groups';
import { IExperimentService } from '../../../common/types';
import { DebugConfigStrings } from '../../../common/utils/localize';
import {
    IMultiStepInput,
    IMultiStepInputFactory,
    InputStep,
    IQuickPickParameters,
} from '../../../common/utils/multiStepInput';
import { AttachRequestArguments, DebugConfigurationArguments, LaunchRequestArguments } from '../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationService } from '../types';
import { IDebugConfigurationProviderFactory, IDebugConfigurationResolver } from './types';

@injectable()
export class PythonDebugConfigurationService implements IDebugConfigurationService {
    private cacheDebugConfig: DebugConfiguration | undefined = undefined;
    constructor(
        @inject(IDebugConfigurationResolver)
        @named('attach')
        private readonly attachResolver: IDebugConfigurationResolver<AttachRequestArguments>,
        @inject(IDebugConfigurationResolver)
        @named('launch')
        private readonly launchResolver: IDebugConfigurationResolver<LaunchRequestArguments>,
        @inject(IDebugConfigurationProviderFactory)
        private readonly providerFactory: IDebugConfigurationProviderFactory,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IExperimentService) private readonly experiments: IExperimentService,
    ) {}

    public async provideDebugConfigurations(
        folder: WorkspaceFolder | undefined,
        token?: CancellationToken,
    ): Promise<DebugConfiguration[] | undefined> {
        const config: Partial<DebugConfigurationArguments> = {};
        const state = { config, folder, token };

        // Disabled until configuration issues are addressed by VS Code. See #4007
        const multiStep = this.multiStepFactory.create<DebugConfigurationState>();
        await multiStep.run((input, s) => this.pickDebugConfiguration(input, s), state);

        if (Object.keys(state.config).length === 0) {
            return;
        } else {
            return [state.config as DebugConfiguration];
        }
    }

    public async resolveDebugConfiguration(
        folder: WorkspaceFolder | undefined,
        debugConfiguration: DebugConfiguration,
        token?: CancellationToken,
    ): Promise<DebugConfiguration | undefined> {
        if (debugConfiguration.request === 'attach') {
            return this.attachResolver.resolveDebugConfiguration(
                folder,
                debugConfiguration as AttachRequestArguments,
                token,
            );
        } else if (debugConfiguration.request === 'test') {
            // `"request": "test"` is now deprecated. But some users might have it in their
            // launch config. We get here if they triggered it using F5 or start with debugger.
            throw Error(
                'This configuration can only be used by the test debugging commands. `"request": "test"` is deprecated use "purpose" instead.',
            );
        } else if (((debugConfiguration as LaunchRequestArguments).purpose ?? []).length > 0) {
            // We reach here only if people try to use debug-test or debug-in-terminal purpose for
            // launching a file via F5 or "start with debugging".
            // debug-test : is not allowed to be launched via (F5 or "start with debugging") since it
            //              requires test framework specific configuration that is done in the test
            //              debug launcher.
            // debug-in-terminal : is not allowed because we may update the configuration based on
            //                     editor context where it was triggered.
            throw Error('This configuration can only be used as defined by `purpose`.');
        } else {
            if ((await this.experiments.inExperiment(CacheDebugConfig.experiment)) && this.cacheDebugConfig) {
                debugConfiguration = cloneDeep(this.cacheDebugConfig);
            }
            if (Object.keys(debugConfiguration).length === 0) {
                const configs = await this.provideDebugConfigurations(folder, token);
                if (configs === undefined) {
                    return;
                }
                if (Array.isArray(configs) && configs.length === 1) {
                    debugConfiguration = configs[0];
                }
                this.cacheDebugConfig = cloneDeep(debugConfiguration);
            }
            return this.launchResolver.resolveDebugConfiguration(
                folder,
                debugConfiguration as LaunchRequestArguments,
                token,
            );
        }
    }

    public async resolveDebugConfigurationWithSubstitutedVariables(
        folder: WorkspaceFolder | undefined,
        debugConfiguration: DebugConfiguration,
        token?: CancellationToken,
    ): Promise<DebugConfiguration | undefined> {
        function resolve<T extends DebugConfiguration>(resolver: IDebugConfigurationResolver<T>) {
            return resolver.resolveDebugConfigurationWithSubstitutedVariables(folder, debugConfiguration as T, token);
        }
        return debugConfiguration.request === 'attach' ? resolve(this.attachResolver) : resolve(this.launchResolver);
    }

    protected async pickDebugConfiguration(
        input: IMultiStepInput<DebugConfigurationState>,
        state: DebugConfigurationState,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        type DebugConfigurationQuickPickItem = QuickPickItem & { type: DebugConfigurationType };
        const items: DebugConfigurationQuickPickItem[] = [
            {
                label: DebugConfigStrings.file.selectConfiguration.label(),
                type: DebugConfigurationType.launchFile,
                description: DebugConfigStrings.file.selectConfiguration.description(),
            },
            {
                label: DebugConfigStrings.module.selectConfiguration.label(),
                type: DebugConfigurationType.launchModule,
                description: DebugConfigStrings.module.selectConfiguration.description(),
            },
            {
                label: DebugConfigStrings.attach.selectConfiguration.label(),
                type: DebugConfigurationType.remoteAttach,
                description: DebugConfigStrings.attach.selectConfiguration.description(),
            },
            {
                label: DebugConfigStrings.attachPid.selectConfiguration.label(),
                type: DebugConfigurationType.pidAttach,
                description: DebugConfigStrings.attachPid.selectConfiguration.description(),
            },
            {
                label: DebugConfigStrings.django.selectConfiguration.label(),
                type: DebugConfigurationType.launchDjango,
                description: DebugConfigStrings.django.selectConfiguration.description(),
            },
            {
                label: DebugConfigStrings.fastapi.selectConfiguration.label(),
                type: DebugConfigurationType.launchFastAPI,
                description: DebugConfigStrings.fastapi.selectConfiguration.description(),
            },
            {
                label: DebugConfigStrings.flask.selectConfiguration.label(),
                type: DebugConfigurationType.launchFlask,
                description: DebugConfigStrings.flask.selectConfiguration.description(),
            },
            {
                label: DebugConfigStrings.pyramid.selectConfiguration.label(),
                type: DebugConfigurationType.launchPyramid,
                description: DebugConfigStrings.pyramid.selectConfiguration.description(),
            },
        ];
        state.config = {};
        const pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: DebugConfigStrings.selectConfiguration.title(),
            placeholder: DebugConfigStrings.selectConfiguration.placeholder(),
            activeItem: items[0],
            items: items,
        });
        if (pick) {
            const provider = this.providerFactory.create(pick.type);
            return provider.buildConfiguration.bind(provider);
        }
    }
}
