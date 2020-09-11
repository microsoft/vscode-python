// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExtensions } from '../../common/types';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { PythonEnvironment } from '../../pythonEnvironments/info';

type PythonApiForJupyterExtension = {
    getInterpreters(resource?: Uri): Promise<PythonEnvironment[]>;
    getActiveInterpreter(resource?: Uri): Promise<PythonEnvironment | undefined>;
    getInterpreterDetails(pythonPath: string): Promise<undefined | PythonEnvironment>;
    getActivatedEnvironmentVariables(options: {
        pythonPath: string;
        resource?: Uri;
    }): Promise<NodeJS.ProcessEnv | undefined>;
};

type JupyterExtensionApi = {
    registerPythonApi(interpreterService: PythonApiForJupyterExtension): void;
};

@injectable()
export class JupyterExtensionIntegration {
    constructor(
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IEnvironmentActivationService) private readonly envActivation: IEnvironmentActivationService
    ) {}

    public async integrateWithJupyterExtension(): Promise<void> {
        const jupyterExtension = this.extensions.getExtension<JupyterExtensionApi>('ms-python.jupyter');
        if (!jupyterExtension) {
            return;
        }
        if (!jupyterExtension.isActive) {
            await jupyterExtension.activate();
        }
        await jupyterExtension.activate();
        if (jupyterExtension.isActive) {
            const jupyterExtensionApi = jupyterExtension.exports;
            jupyterExtensionApi.registerPythonApi({
                getActiveInterpreter: async (resource?: Uri) => this.interpreterService.getActiveInterpreter(resource),
                getInterpreterDetails: async (pythonPath: string) =>
                    // eslint-disable-next-line implicit-arrow-linebreak
                    this.interpreterService.getInterpreterDetails(pythonPath),
                getInterpreters: async (resource: Uri | undefined) => this.interpreterService.getInterpreters(resource),
                getActivatedEnvironmentVariables: async (options: { pythonPath: string; resource?: Uri }) => {
                    const interpreter = await this.interpreterService.getInterpreterDetails(
                        options.pythonPath,
                        // eslint-disable-next-line comma-dangle
                        options.resource
                    );
                    return this.envActivation.getActivatedEnvironmentVariables(
                        options.resource,
                        interpreter,
                        // eslint-disable-next-line comma-dangle
                        true
                    );
                    // eslint-disable-next-line comma-dangle
                }
            });
        }
    }
}
