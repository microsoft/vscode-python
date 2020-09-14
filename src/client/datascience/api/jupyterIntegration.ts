// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable comma-dangle */
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable implicit-arrow-linebreak */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { CancellationToken, Event, Uri } from 'vscode';
import { InterpreterUri } from '../../common/installer/types';
import { IExtensions, IInstaller, InstallerResponse, Product, Resource } from '../../common/types';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { IInterpreterQuickPickItem, IInterpreterSelector } from '../../interpreter/configuration/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { IWindowsStoreInterpreter } from '../../interpreter/locators/types';
import { WindowsStoreInterpreter } from '../../pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';
import { PythonEnvironment } from '../../pythonEnvironments/info';

type PythonApiForJupyterExtension = {
    /**
     * IInterpreterService
     */
    onDidChangeInterpreter: Event<void>;
    /**
     * IInterpreterService
     */
    getInterpreters(resource?: Uri): Promise<PythonEnvironment[]>;
    /**
     * IInterpreterService
     */
    getActiveInterpreter(resource?: Uri): Promise<PythonEnvironment | undefined>;
    /**
     * IInterpreterService
     */
    getInterpreterDetails(pythonPath: string, resource?: Uri): Promise<undefined | PythonEnvironment>;

    /**
     * IEnvironmentActivationService
     */
    getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonEnvironment,
        allowExceptions?: boolean
    ): Promise<NodeJS.ProcessEnv | undefined>;
    isWindowsStoreInterpreter(pythonPath: string): Promise<boolean>;
    /**
     * IWindowsStoreInterpreter
     */
    getSuggestions(resource: Resource): Promise<IInterpreterQuickPickItem[]>;
    /**
     * IInstaller
     */
    install(product: Product, resource?: InterpreterUri, cancel?: CancellationToken): Promise<InstallerResponse>;
};

type JupyterExtensionApi = {
    registerPythonApi(interpreterService: PythonApiForJupyterExtension): void;
};

@injectable()
export class JupyterExtensionIntegration {
    constructor(
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter,
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IEnvironmentActivationService) private readonly envActivation: IEnvironmentActivationService
    ) {}

    public async integrateWithJupyterExtension(): Promise<void> {
        const jupyterExtension = this.extensions.getExtension<JupyterExtensionApi>('ms-ai-tools.jupyter');
        if (!jupyterExtension) {
            return;
        }
        await jupyterExtension.activate();
        if (!jupyterExtension.isActive) {
            return;
        }
        const jupyterExtensionApi = jupyterExtension.exports;
        jupyterExtensionApi.registerPythonApi({
            onDidChangeInterpreter: this.interpreterService.onDidChangeInterpreter,
            getActiveInterpreter: async (resource?: Uri) => this.interpreterService.getActiveInterpreter(resource),
            getInterpreterDetails: async (pythonPath: string) =>
                this.interpreterService.getInterpreterDetails(pythonPath),
            getInterpreters: async (resource: Uri | undefined) => this.interpreterService.getInterpreters(resource),
            getActivatedEnvironmentVariables: async (
                resource: Resource,
                interpreter?: PythonEnvironment,
                allowExceptions?: boolean
            ) => this.envActivation.getActivatedEnvironmentVariables(resource, interpreter, allowExceptions),
            isWindowsStoreInterpreter: async (pythonPath: string): Promise<boolean> =>
                this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath),
            getSuggestions: async (resource: Resource): Promise<IInterpreterQuickPickItem[]> =>
                this.interpreterSelector.getSuggestions(resource),
            install: async (
                product: Product,
                resource?: InterpreterUri,
                cancel?: CancellationToken
            ): Promise<InstallerResponse> => this.installer.install(product, resource, cancel)
        });
    }
}
