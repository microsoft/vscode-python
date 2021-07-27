/* eslint-disable comma-dangle */

/* eslint-disable implicit-arrow-linebreak */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { dirname } from 'path';
import { CancellationToken, Extension, Memento, Uri } from 'vscode';
import { ILanguageServerCache } from '../activation/types';
import { DATA_WRANGLER_EXTENSION_ID } from '../common/constants';
import { InterpreterUri, ModuleInstallFlags } from '../common/installer/types';
import {
    GLOBAL_MEMENTO,
    IExperimentService,
    IExtensions,
    IInstaller,
    IMemento,
    InstallerResponse,
    Product,
    ProductInstallStatus,
    Resource,
} from '../common/types';
import { isResource } from '../common/utils/misc';
import { getDebugpyPackagePath } from '../debugger/extension/adapter/remoteLaunchers';
import { IEnvironmentActivationService } from '../interpreter/activation/types';
import { IInterpreterQuickPickItem, IInterpreterSelector } from '../interpreter/configuration/types';
import { IComponentAdapter, IInterpreterDisplay, IInterpreterService } from '../interpreter/contracts';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { IDataViewerDataProvider, IJupyterUriProvider } from './types';
import { inDiscoveryExperiment } from '../common/experiments/helpers';
import { isWindowsStoreInterpreter } from '../pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';
import { JupyterExtensionApi, JupyterProductToInstall, ProductMapping } from './jupyterIntegration';

@injectable()
export class DataWranglerExtensionIntegration {
    private dataWranglerExtension: Extension<JupyterExtensionApi> | undefined;

    constructor(
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector,
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IEnvironmentActivationService) private readonly envActivation: IEnvironmentActivationService,
        @inject(ILanguageServerCache) private readonly languageServerCache: ILanguageServerCache,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: Memento,
        @inject(IInterpreterDisplay) private interpreterDisplay: IInterpreterDisplay,
        @inject(IComponentAdapter) private pyenvs: IComponentAdapter,
        @inject(IExperimentService) private experimentService: IExperimentService,
    ) {}

    public registerApi(jupyterExtensionApi: JupyterExtensionApi): JupyterExtensionApi | undefined {
        // Forward python parts
        jupyterExtensionApi.registerPythonApi({
            onDidChangeInterpreter: this.interpreterService.onDidChangeInterpreter,
            getActiveInterpreter: async (resource?: Uri) => this.interpreterService.getActiveInterpreter(resource),
            getInterpreterDetails: async (pythonPath: string) =>
                this.interpreterService.getInterpreterDetails(pythonPath),
            getInterpreters: async (resource: Uri | undefined) => this.interpreterService.getInterpreters(resource),
            getActivatedEnvironmentVariables: async (
                resource: Resource,
                interpreter?: PythonEnvironment,
                allowExceptions?: boolean,
            ) => this.envActivation.getActivatedEnvironmentVariables(resource, interpreter, allowExceptions),
            isWindowsStoreInterpreter: async (pythonPath: string): Promise<boolean> => {
                if (await inDiscoveryExperiment(this.experimentService)) {
                    return this.pyenvs.isWindowsStoreInterpreter(pythonPath);
                }
                return isWindowsStoreInterpreter(pythonPath);
            },
            getSuggestions: async (resource: Resource): Promise<IInterpreterQuickPickItem[]> =>
                this.interpreterSelector.getSuggestions(resource),
            install: async (
                product: JupyterProductToInstall,
                resource?: InterpreterUri,
                cancel?: CancellationToken,
                reInstallAndUpdate?: boolean,
            ): Promise<InstallerResponse> =>
                this.installer.install(
                    ProductMapping[product],
                    resource,
                    cancel,
                    reInstallAndUpdate === true
                        ? ModuleInstallFlags.updateDependencies | ModuleInstallFlags.reInstall
                        : undefined,
                ),
            isProductVersionCompatible: async (
                product: Product,
                semVerRequirement: string,
                resource?: InterpreterUri,
            ): Promise<ProductInstallStatus> =>
                this.installer.isProductVersionCompatible(product, semVerRequirement, resource),
            getDebuggerPath: async () => dirname(getDebugpyPackagePath()),
            getInterpreterPathSelectedForJupyterServer: () =>
                this.globalState.get<string | undefined>('INTERPRETER_PATH_SELECTED_FOR_JUPYTER_SERVER'),
            getLanguageServer: async (r) => {
                const resource = isResource(r) ? r : undefined;
                const interpreter = !isResource(r) ? r : undefined;
                const client = await this.languageServerCache.get(resource, interpreter);

                // Some language servers don't support the connection yet. (like Jedi until we switch to LSP)
                if (client && client.connection && client.capabilities) {
                    return {
                        connection: client.connection,
                        capabilities: client.capabilities,
                        dispose: client.dispose,
                    };
                }
                return undefined;
            },
            registerInterpreterStatusFilter: this.interpreterDisplay.registerVisibilityFilter.bind(
                this.interpreterDisplay,
            ),
        });
        return undefined;
    }

    public async integrateWithDataWranglerExtension(): Promise<void> {
        const api = await this.getExtensionApi();
        if (api) {
            this.registerApi(api);
        }
    }

    public registerRemoteServerProvider(serverProvider: IJupyterUriProvider): void {
        this.getExtensionApi()
            .then((e) => {
                if (e) {
                    e.registerRemoteServerProvider(serverProvider);
                }
            })
            .ignoreErrors();
    }

    public async showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void> {
        const api = await this.getExtensionApi();
        if (api) {
            return api.showDataViewer(dataProvider, title);
        }
        return undefined;
    }

    private async getExtensionApi(): Promise<JupyterExtensionApi | undefined> {
        if (!this.dataWranglerExtension) {
            const dataWranglerExtension = this.extensions.getExtension<JupyterExtensionApi>(DATA_WRANGLER_EXTENSION_ID);
            if (!dataWranglerExtension) {
                return undefined;
            }
            await dataWranglerExtension.activate();
            if (dataWranglerExtension.isActive) {
                this.dataWranglerExtension = dataWranglerExtension;
                return this.dataWranglerExtension.exports;
            }
        } else {
            return this.dataWranglerExtension.exports;
        }
        return undefined;
    }
}
