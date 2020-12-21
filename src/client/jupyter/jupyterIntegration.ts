// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable comma-dangle */
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable implicit-arrow-linebreak */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { dirname } from 'path';
import { CancellationToken, Disposable, Event, Extension, Memento, Uri } from 'vscode';
import * as lsp from 'vscode-languageserver-protocol';
import { ILanguageServerCache, ILanguageServerConnection } from '../activation/types';
import { JUPYTER_EXTENSION_ID } from '../common/constants';
import { InterpreterUri } from '../common/installer/types';
import {
    GLOBAL_MEMENTO,
    IExtensions,
    IInstaller,
    IMemento,
    InstallerResponse,
    Product,
    Resource,
} from '../common/types';
import { isResource } from '../common/utils/misc';
import { getDebugpyPackagePath } from '../debugger/extension/adapter/remoteLaunchers';
import { IEnvironmentActivationService } from '../interpreter/activation/types';
import { IInterpreterQuickPickItem, IInterpreterSelector } from '../interpreter/configuration/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IWindowsStoreInterpreter } from '../interpreter/locators/types';
import { WindowsStoreInterpreter } from '../pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { IDataViewerDataProvider, IJupyterUriProvider } from './types';

export interface ILanguageServer extends Disposable {
    readonly connection: ILanguageServerConnection;
    readonly capabilities: lsp.ServerCapabilities;
}

/**
 * This allows Python exntension to update Product enum without breaking Jupyter.
 * I.e. we have a strict contract, else using numbers (in enums) is bound to break across products.
 */
enum JupyterProductToInstall {
    jupyter = 'jupyter',
    ipykernel = 'ipykernel',
    notebook = 'notebook',
    kernelspec = 'kernelspec',
    nbconvert = 'nbconvert',
    pandas = 'pandas',
}

const ProductMapping: { [key in JupyterProductToInstall]: Product } = {
    [JupyterProductToInstall.ipykernel]: Product.ipykernel,
    [JupyterProductToInstall.jupyter]: Product.jupyter,
    [JupyterProductToInstall.kernelspec]: Product.kernelspec,
    [JupyterProductToInstall.nbconvert]: Product.nbconvert,
    [JupyterProductToInstall.notebook]: Product.notebook,
    [JupyterProductToInstall.pandas]: Product.pandas,
};

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
        allowExceptions?: boolean,
    ): Promise<NodeJS.ProcessEnv | undefined>;
    isWindowsStoreInterpreter(pythonPath: string): Promise<boolean>;
    /**
     * IWindowsStoreInterpreter
     */
    getSuggestions(resource: Resource): Promise<IInterpreterQuickPickItem[]>;
    /**
     * IInstaller
     */
    install(
        product: JupyterProductToInstall,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
    ): Promise<InstallerResponse>;
    /**
     * Returns path to where `debugpy` is. In python extension this is `/pythonFiles/lib/python`.
     */
    getDebuggerPath(): Promise<string>;
    /**
     * Retrieve interpreter path selected for Jupyter server from Python memento storage
     */
    getInterpreterPathSelectedForJupyterServer(): string | undefined;
    /**
     * Returns a ILanguageServer that can be used for communicating with a language server process.
     * @param resource file that determines which connection to return
     */
    getLanguageServer(resource?: InterpreterUri): Promise<ILanguageServer | undefined>;
};

export type JupyterExtensionApi = {
    /**
     * Registers python extension specific parts with the jupyter extension
     * @param interpreterService
     */
    registerPythonApi(interpreterService: PythonApiForJupyterExtension): void;
    /**
     * Launches Data Viewer component.
     * @param {IDataViewerDataProvider} dataProvider Instance that will be used by the Data Viewer component to fetch data.
     * @param {string} title Data Viewer title
     */
    showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void>;
    /**
     * Registers a remote server provider component that's used to pick remote jupyter server URIs
     * @param serverProvider object called back when picking jupyter server URI
     */
    registerRemoteServerProvider(serverProvider: IJupyterUriProvider): void;
};

@injectable()
export class JupyterExtensionIntegration {
    private jupyterExtension: Extension<JupyterExtensionApi> | undefined;

    constructor(
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter,
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IEnvironmentActivationService) private readonly envActivation: IEnvironmentActivationService,
        @inject(ILanguageServerCache) private readonly languageServerCache: ILanguageServerCache,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: Memento,
    ) {}

    public registerApi(jupyterExtensionApi: JupyterExtensionApi) {
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
            isWindowsStoreInterpreter: async (pythonPath: string): Promise<boolean> =>
                this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath),
            getSuggestions: async (resource: Resource): Promise<IInterpreterQuickPickItem[]> =>
                this.interpreterSelector.getSuggestions(resource),
            install: async (
                product: JupyterProductToInstall,
                resource?: InterpreterUri,
                cancel?: CancellationToken,
            ): Promise<InstallerResponse> => this.installer.install(ProductMapping[product], resource, cancel),
            getDebuggerPath: async () => dirname(getDebugpyPackagePath()),
            getInterpreterPathSelectedForJupyterServer: () =>
                this.globalState.get<string | undefined>('INTERPRETER_PATH_SELECTED_FOR_JUPYTER_SERVER'),
            getLanguageServer: async (r) => {
                const resource = isResource(r) ? r : undefined;
                const interpreter = !isResource(r) ? r : undefined;
                const client = await this.languageServerCache.get(resource, interpreter);

                // Some langauge servers don't support the connection yet. (like Jedi until we switch to LSP)
                if (client && client.connection && client.capabilities) {
                    return {
                        connection: client.connection,
                        capabilities: client.capabilities,
                        dispose: client.dispose,
                    };
                }
                return undefined;
            },
        });
    }

    public async integrateWithJupyterExtension(): Promise<void> {
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
        if (!this.jupyterExtension) {
            const jupyterExtension = this.extensions.getExtension<JupyterExtensionApi>(JUPYTER_EXTENSION_ID);
            if (!jupyterExtension) {
                return undefined;
            }
            await jupyterExtension.activate();
            if (jupyterExtension.isActive) {
                this.jupyterExtension = jupyterExtension;
                return this.jupyterExtension.exports;
            }
        } else {
            return this.jupyterExtension.exports;
        }
        return undefined;
    }
}
