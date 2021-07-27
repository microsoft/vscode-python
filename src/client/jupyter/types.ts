// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { QuickPickItem, Disposable, Event, Uri, CancellationToken } from 'vscode';
import * as lsp from 'vscode-languageserver-protocol';
import { ILanguageServerConnection } from '../activation/types';
import { InterpreterUri } from '../common/installer/types';
import { InstallerResponse, Product, ProductInstallStatus, Resource } from '../common/types';
import { IInterpreterQuickPickItem } from '../interpreter/configuration/types';
import { IInterpreterStatusbarVisibilityFilter } from '../interpreter/contracts';
import { PythonEnvironment } from '../pythonEnvironments/info';

interface IJupyterServerUri {
    baseUrl: string;
    token: string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authorizationHeader: any; // JSON object for authorization header.
    expiration?: Date; // Date/time when header expires and should be refreshed.
    displayName: string;
}

type JupyterServerUriHandle = string;

export interface IJupyterUriProvider {
    readonly id: string; // Should be a unique string (like a guid)
    getQuickPickEntryItems(): QuickPickItem[];
    handleQuickPick(item: QuickPickItem, backEnabled: boolean): Promise<JupyterServerUriHandle | 'back' | undefined>;
    getServerUri(handle: JupyterServerUriHandle): Promise<IJupyterServerUri>;
}

interface IDataFrameInfo {
    columns?: { key: string; type: ColumnType }[];
    indexColumn?: string;
    rowCount?: number;
}

export interface IDataViewerDataProvider {
    dispose(): void;
    getDataFrameInfo(): Promise<IDataFrameInfo>;
    getAllRows(): Promise<IRowsResponse>;
    getRows(start: number, end: number): Promise<IRowsResponse>;
}

enum ColumnType {
    String = 'string',
    Number = 'number',
    Bool = 'bool',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IRowsResponse = any[];

export enum JupyterNotInstalledOrigin {
    StartPageOpenBlankNotebook = 'startpage_open_blank_notebook',
    StartPageOpenSampleNotebook = 'startpage_open_sample_notebook',
    StartPageOpenInteractiveWindow = 'startpage_open_interactive_window',
}

export const IJupyterNotInstalledNotificationHelper = Symbol('IJupyterNotInstalledNotificationHelper');
export interface IJupyterNotInstalledNotificationHelper {
    shouldShowJupypterExtensionNotInstalledPrompt(): boolean;
    showJupyterNotInstalledPrompt(entrypoint: JupyterNotInstalledOrigin): Promise<void>;
}

interface ILanguageServer extends Disposable {
    readonly connection: ILanguageServerConnection;
    readonly capabilities: lsp.ServerCapabilities;
}

/**
 * This allows Python extension to update Product enum without breaking Jupyter.
 * I.e. we have a strict contract, else using numbers (in enums) is bound to break across products.
 */
export enum JupyterProductToInstall {
    jupyter = 'jupyter',
    ipykernel = 'ipykernel',
    notebook = 'notebook',
    kernelspec = 'kernelspec',
    nbconvert = 'nbconvert',
    pandas = 'pandas',
}

export const ProductMapping: { [key in JupyterProductToInstall]: Product } = {
    [JupyterProductToInstall.ipykernel]: Product.ipykernel,
    [JupyterProductToInstall.jupyter]: Product.jupyter,
    [JupyterProductToInstall.kernelspec]: Product.kernelspec,
    [JupyterProductToInstall.nbconvert]: Product.nbconvert,
    [JupyterProductToInstall.notebook]: Product.notebook,
    [JupyterProductToInstall.pandas]: Product.pandas,
};

export interface PythonApiForJupyterExtension extends PythonApiForDataWranglerExtension {
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
    /**
     * Registers a visibility filter for the interpreter status bar.
     */
    registerInterpreterStatusFilter(filter: IInterpreterStatusbarVisibilityFilter): void;
}

export interface JupyterExtensionApi extends DataWranglerExtensionApi {}

export interface PythonApiForDataWranglerExtension {
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
     * IInstaller
     */
    isProductVersionCompatible(
        product: Product,
        semVerRequirement: string,
        resource?: InterpreterUri,
    ): Promise<ProductInstallStatus>;
}

export type DataWranglerExtensionApi = {
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
