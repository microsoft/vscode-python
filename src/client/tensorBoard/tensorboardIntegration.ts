/* eslint-disable comma-dangle */

/* eslint-disable implicit-arrow-linebreak */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Extension, Uri } from 'vscode';
import { IWorkspaceService } from '../common/application/types';
import { TENSORBOARD_EXTENSION_ID } from '../common/constants';
import { IExtensions, Resource } from '../common/types';
import { IEnvironmentActivationService } from '../interpreter/activation/types';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { ITensorboardDependencyChecker } from './types';

type PythonApiForTensorboardExtension = {
    getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonEnvironment,
        allowExceptions?: boolean,
    ): Promise<NodeJS.ProcessEnv | undefined>;
    ensureDependenciesAreInstalled(resource?: Uri): Promise<boolean>;
};

type TensorboardExtensionApi = {
    /**
     * Registers python extension specific parts with the tensorboard extension
     */
    registerPythonApi(interpreterService: PythonApiForTensorboardExtension): void;
};

@injectable()
export class TensorboardExtensionIntegration {
    private tensorboardExtension: Extension<TensorboardExtensionApi> | undefined;

    constructor(
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IEnvironmentActivationService) private readonly envActivation: IEnvironmentActivationService,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(ITensorboardDependencyChecker) private readonly dependencyChcker: ITensorboardDependencyChecker,
    ) {}

    public registerApi(tensorboardExtensionApi: TensorboardExtensionApi): TensorboardExtensionApi | undefined {
        if (!this.workspaceService.isTrusted) {
            this.workspaceService.onDidGrantWorkspaceTrust(() => this.registerApi(tensorboardExtensionApi));
            return undefined;
        }
        tensorboardExtensionApi.registerPythonApi({
            getActivatedEnvironmentVariables: async (
                resource: Resource,
                interpreter?: PythonEnvironment,
                allowExceptions?: boolean,
            ) => this.envActivation.getActivatedEnvironmentVariables(resource, interpreter, allowExceptions),
            ensureDependenciesAreInstalled: async (resource?: Uri): Promise<boolean> =>
                this.dependencyChcker.ensureDependenciesAreInstalled(resource),
        });
        return undefined;
    }

    public async integrateWithTensorboardExtension(): Promise<void> {
        const api = await this.getExtensionApi();
        if (api) {
            this.registerApi(api);
        }
    }

    private async getExtensionApi(): Promise<TensorboardExtensionApi | undefined> {
        if (!this.tensorboardExtension) {
            const extension = this.extensions.getExtension<TensorboardExtensionApi>(TENSORBOARD_EXTENSION_ID);
            if (!extension) {
                return undefined;
            }
            await extension.activate();
            if (extension.isActive) {
                this.tensorboardExtension = extension;
                return this.tensorboardExtension.exports;
            }
        } else {
            return this.tensorboardExtension.exports;
        }
        return undefined;
    }
}
