// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, Disposable } from 'vscode';
import { Commands } from '../../common/constants';
import { IDisposableRegistry, IInterpreterPathService, IPathUtils } from '../../common/types';
import { executeCommand, registerCommand } from '../../common/vscodeApis/commandApis';
import { IInterpreterQuickPick } from '../../interpreter/configuration/types';
import { getCreationEvents, handleCreateEnvironmentCommand } from './createEnvironment';
import { condaCreationProvider } from './provider/condaCreationProvider';
import { VenvCreationProvider } from './provider/venvCreationProvider';
import { showInformationMessage } from '../../common/vscodeApis/windowApis';
import { CreateEnv } from '../../common/utils/localize';
import {
    CreateEnvironmentProvider,
    CreateEnvironmentOptions,
    CreateEnvironmentResult,
    ProposedCreateEnvironmentAPI,
    EnvironmentDidCreateEvent,
} from './proposed.createEnvApis';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { CreateEnvironmentOptionsInternal } from './types';

class CreateEnvironmentProviders {
    private _createEnvProviders: CreateEnvironmentProvider[] = [];

    constructor() {
        this._createEnvProviders = [];
    }

    public add(provider: CreateEnvironmentProvider) {
        if (this._createEnvProviders.filter((p) => p.id === provider.id).length > 0) {
            throw new Error(`Create Environment provider with id ${provider.id} already registered`);
        }
        this._createEnvProviders.push(provider);
    }

    public remove(provider: CreateEnvironmentProvider) {
        this._createEnvProviders = this._createEnvProviders.filter((p) => p !== provider);
    }

    public getAll(): readonly CreateEnvironmentProvider[] {
        return this._createEnvProviders;
    }
}

const _createEnvironmentProviders: CreateEnvironmentProviders = new CreateEnvironmentProviders();

export function registerCreateEnvironmentProvider(provider: CreateEnvironmentProvider): Disposable {
    _createEnvironmentProviders.add(provider);
    return new Disposable(() => {
        _createEnvironmentProviders.remove(provider);
    });
}

export const { onCreateEnvironmentStarted, onCreateEnvironmentExited, isCreatingEnvironment } = getCreationEvents();

export function registerCreateEnvironmentFeatures(
    disposables: IDisposableRegistry,
    interpreterQuickPick: IInterpreterQuickPick,
    interpreterPathService: IInterpreterPathService,
    pathUtils: IPathUtils,
): void {
    disposables.push(
        registerCommand(
            Commands.Create_Environment,
            (
                options?: CreateEnvironmentOptions & CreateEnvironmentOptionsInternal,
            ): Promise<CreateEnvironmentResult | undefined> => {
                const providers = _createEnvironmentProviders.getAll();
                return handleCreateEnvironmentCommand(providers, options);
            },
        ),
        registerCommand(
            Commands.Create_Environment_Button,
            async (): Promise<void> => {
                sendTelemetryEvent(EventName.ENVIRONMENT_BUTTON, undefined, undefined);
                await executeCommand(Commands.Create_Environment);
            },
        ),
        registerCreateEnvironmentProvider(new VenvCreationProvider(interpreterQuickPick)),
        registerCreateEnvironmentProvider(condaCreationProvider()),
        onCreateEnvironmentExited(async (e: EnvironmentDidCreateEvent) => {
            if (e.path && e.options?.selectEnvironment) {
                await interpreterPathService.update(
                    e.workspaceFolder?.uri,
                    ConfigurationTarget.WorkspaceFolder,
                    e.path,
                );
                showInformationMessage(`${CreateEnv.informEnvCreation} ${pathUtils.getDisplayName(e.path)}`);
            }
        }),
    );
}

export function buildEnvironmentCreationApi(): ProposedCreateEnvironmentAPI {
    return {
        onWillCreateEnvironment: onCreateEnvironmentStarted,
        onDidCreateEnvironment: onCreateEnvironmentExited,
        createEnvironment: async (
            options?: CreateEnvironmentOptions | undefined,
        ): Promise<CreateEnvironmentResult | undefined> => {
            const providers = _createEnvironmentProviders.getAll();
            try {
                return await handleCreateEnvironmentCommand(providers, options);
            } catch (err) {
                return { path: undefined, workspaceFolder: undefined, action: undefined, error: err as Error };
            }
        },
        registerCreateEnvironmentProvider: (provider: CreateEnvironmentProvider) =>
            registerCreateEnvironmentProvider(provider),
    };
}
