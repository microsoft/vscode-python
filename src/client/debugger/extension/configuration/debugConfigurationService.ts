// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { cloneDeep } from 'lodash';
import { CancellationToken, DebugConfiguration, QuickPickItem, WorkspaceFolder } from 'vscode';
import { DebugConfigStrings } from '../../../common/utils/localize';
import {
    IMultiStepInputFactory,
    InputStep,
    IQuickPickParameters,
    MultiStepInput,
} from '../../../common/utils/multiStepInput';
import { AttachRequestArguments, DebugConfigurationArguments, LaunchRequestArguments } from '../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationService } from '../types';
import { buildDjangoLaunchDebugConfiguration } from './providers/djangoLaunch';
import { buildFastAPILaunchDebugConfiguration } from './providers/fastapiLaunch';
import { buildFileLaunchDebugConfiguration } from './providers/fileLaunch';
import { buildFlaskLaunchDebugConfiguration } from './providers/flaskLaunch';
import { buildModuleLaunchConfiguration } from './providers/moduleLaunch';
import { buildPidAttachConfiguration } from './providers/pidAttach';
import { buildPyramidLaunchConfiguration } from './providers/pyramidLaunch';
import { buildRemoteAttachConfiguration } from './providers/remoteAttach';
import { IDebugConfigurationResolver } from './types';

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
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
    ) {}

    public async provideDebugConfigurations(
        folder: WorkspaceFolder | undefined,
        token?: CancellationToken,
    ): Promise<DebugConfiguration[] | undefined> {
        const config: Partial<DebugConfigurationArguments> = {};
        const state = { config, folder, token };

        // Disabled until configuration issues are addressed by VS Code. See #4007
        const multiStep = this.multiStepFactory.create<DebugConfigurationState>();
        await multiStep.run((input, s) => PythonDebugConfigurationService.pickDebugConfiguration(input, s), state);

        if (Object.keys(state.config).length !== 0) {
            return [state.config as DebugConfiguration];
        }
        return undefined;
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
        }
        if (debugConfiguration.request === 'test') {
            // `"request": "test"` is now deprecated. But some users might have it in their
            // launch config. We get here if they triggered it using F5 or start with debugger.
            throw Error(
                'This configuration can only be used by the test debugging commands. `"request": "test"` is deprecated, please keep as `"request": "launch"` and add `"purpose": ["debug-test"]` instead.',
            );
        } else {
            if (Object.keys(debugConfiguration).length === 0) {
                if (this.cacheDebugConfig) {
                    debugConfiguration = cloneDeep(this.cacheDebugConfig);
                } else {
                    const configs = await this.provideDebugConfigurations(folder, token);
                    if (configs === undefined) {
                        return undefined;
                    }
                    if (Array.isArray(configs) && configs.length === 1) {
                        // eslint-disable-next-line prefer-destructuring
                        debugConfiguration = configs[0];
                    }
                    this.cacheDebugConfig = cloneDeep(debugConfiguration);
                }
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

    // eslint-disable-next-line consistent-return
    protected static async pickDebugConfiguration(
        input: MultiStepInput<DebugConfigurationState>,
        state: DebugConfigurationState,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        type DebugConfigurationQuickPickItem = QuickPickItem & { type: DebugConfigurationType };
        const items: DebugConfigurationQuickPickItem[] = [
            {
                label: DebugConfigStrings.file.selectConfiguration.label,
                type: DebugConfigurationType.launchFile,
                description: DebugConfigStrings.file.selectConfiguration.description,
            },
            {
                label: DebugConfigStrings.module.selectConfiguration.label,
                type: DebugConfigurationType.launchModule,
                description: DebugConfigStrings.module.selectConfiguration.description,
            },
            {
                label: DebugConfigStrings.attach.selectConfiguration.label,
                type: DebugConfigurationType.remoteAttach,
                description: DebugConfigStrings.attach.selectConfiguration.description,
            },
            {
                label: DebugConfigStrings.attachPid.selectConfiguration.label,
                type: DebugConfigurationType.pidAttach,
                description: DebugConfigStrings.attachPid.selectConfiguration.description,
            },
            {
                label: DebugConfigStrings.django.selectConfiguration.label,
                type: DebugConfigurationType.launchDjango,
                description: DebugConfigStrings.django.selectConfiguration.description,
            },
            {
                label: DebugConfigStrings.fastapi.selectConfiguration.label,
                type: DebugConfigurationType.launchFastAPI,
                description: DebugConfigStrings.fastapi.selectConfiguration.description,
            },
            {
                label: DebugConfigStrings.flask.selectConfiguration.label,
                type: DebugConfigurationType.launchFlask,
                description: DebugConfigStrings.flask.selectConfiguration.description,
            },
            {
                label: DebugConfigStrings.pyramid.selectConfiguration.label,
                type: DebugConfigurationType.launchPyramid,
                description: DebugConfigStrings.pyramid.selectConfiguration.description,
            },
        ];
        const debugConfigurations = new Map<
            DebugConfigurationType,
            (
                input: MultiStepInput<DebugConfigurationState>,
                state: DebugConfigurationState,
            ) => Promise<void | InputStep<DebugConfigurationState>>
        >();
        debugConfigurations.set(DebugConfigurationType.launchDjango, buildDjangoLaunchDebugConfiguration);
        debugConfigurations.set(DebugConfigurationType.launchFastAPI, buildFastAPILaunchDebugConfiguration);
        debugConfigurations.set(DebugConfigurationType.launchFile, buildFileLaunchDebugConfiguration);
        debugConfigurations.set(DebugConfigurationType.launchFlask, buildFlaskLaunchDebugConfiguration);
        debugConfigurations.set(DebugConfigurationType.launchModule, buildModuleLaunchConfiguration);
        debugConfigurations.set(DebugConfigurationType.pidAttach, buildPidAttachConfiguration);
        debugConfigurations.set(DebugConfigurationType.remoteAttach, buildRemoteAttachConfiguration);
        debugConfigurations.set(DebugConfigurationType.launchPyramid, buildPyramidLaunchConfiguration);

        state.config = {};
        const pick = await input.showQuickPick<
            DebugConfigurationQuickPickItem,
            IQuickPickParameters<DebugConfigurationQuickPickItem>
        >({
            title: DebugConfigStrings.selectConfiguration.title,
            placeholder: DebugConfigStrings.selectConfiguration.placeholder,
            activeItem: items[0],
            items,
        });
        if (pick) {
            const pickedDebugConfiguration = debugConfigurations.get(pick.type)!;
            return pickedDebugConfiguration(input, state);
        }
    }
}
