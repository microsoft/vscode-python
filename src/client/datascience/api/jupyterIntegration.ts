// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable comma-dangle */
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable implicit-arrow-linebreak */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { dirname } from 'path';
import { CancellationToken, Disposable, Event, Uri } from 'vscode';
import * as lsp from 'vscode-languageserver-protocol';
import { ILanguageServerCache, ILanguageServerConnection } from '../../activation/types';
import { InterpreterUri } from '../../common/installer/types';
import { IExtensions, IInstaller, InstallerResponse, Product, Resource } from '../../common/types';
import { isResource } from '../../common/utils/misc';
import { getDebugpyPackagePath } from '../../debugger/extension/adapter/remoteLaunchers';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { IInterpreterQuickPickItem, IInterpreterSelector } from '../../interpreter/configuration/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { IWindowsStoreInterpreter } from '../../interpreter/locators/types';
import { WindowsStoreInterpreter } from '../../pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';
import { PythonEnvironment } from '../../pythonEnvironments/info';

export interface ILanguageServer extends Disposable {
    readonly connection: ILanguageServerConnection;
    readonly capabilities: lsp.ServerCapabilities;
}

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
    /**
     * Returns path to where `debugpy` is. In python extension this is `/pythonFiles/lib/python`.
     */
    getDebuggerPath(): Promise<string>;
    /**
     * Returns a ILanguageServer that can be used for communicating with a language server process.
     * @param resource file that determines which connection to return
     */
    getLanguageServer(resource?: InterpreterUri): Promise<ILanguageServer | undefined>;
};

export type JupyterExtensionApi = {
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
        @inject(IEnvironmentActivationService) private readonly envActivation: IEnvironmentActivationService,
        @inject(ILanguageServerCache) private readonly languageServerCache: ILanguageServerCache
    ) {}

    public registerApi(jupyterExtensionApi: JupyterExtensionApi) {
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
            ): Promise<InstallerResponse> => this.installer.install(product, resource, cancel),
            getDebuggerPath: async () => dirname(getDebugpyPackagePath()),
            getLanguageServer: async (r) => {
                const resource = isResource(r) ? r : undefined;
                const interpreter = !isResource(r) ? r : undefined;
                const client = await this.languageServerCache.get(resource, interpreter);

                // Some langauge servers don't support the connection yet. (like Jedi until we switch to LSP)
                if (client && client.connection && client.capabilities) {
                    return {
                        connection: client.connection,
                        capabilities: client.capabilities,
                        dispose: client.dispose
                    };
                }
                return undefined;
            }
        });
    }

    public async integrateWithJupyterExtension(): Promise<void> {
        const jupyterExtension = this.extensions.getExtension<JupyterExtensionApi>('ms-ai-tools.jupyter');
        if (!jupyterExtension) {
            return;
        }
        await jupyterExtension.activate();
        if (!jupyterExtension.isActive) {
            return;
        }
        this.registerApi(jupyterExtension.exports);
    }
}
