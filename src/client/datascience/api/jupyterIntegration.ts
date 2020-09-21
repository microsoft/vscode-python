// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable comma-dangle */
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable implicit-arrow-linebreak */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { dirname } from 'path';
import { CancellationToken, Event, Uri } from 'vscode';
import {
    Disposable,
    GenericNotificationHandler,
    GenericRequestHandler,
    NotificationHandler,
    NotificationHandler0,
    NotificationType,
    NotificationType0,
    ProgressType,
    RequestHandler,
    RequestHandler0,
    RequestType,
    RequestType0
} from 'vscode-jsonrpc';
import * as vscodeprotocol from 'vscode-languageserver-protocol';
import { ILanguageServerCache } from '../../activation/types';
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

/**
 * This interface is a subset of the vscode-protocol connection interface.
 * It's the minimum set of functions needed in order to talk to a language server.
 */
export interface ILanguageServerConnection {
    /**
     * Sends a request and returns a promise resolving to the result of the request.
     *
     * @param type The type of request to sent.
     * @param token An optional cancellation token.
     * @returns A promise resolving to the request's result.
     */
    sendRequest<R, E, RO>(type: RequestType0<R, E, RO>, token?: CancellationToken): Promise<R>;
    /**
     * Sends a request and returns a promise resolving to the result of the request.
     *
     * @param type The type of request to sent.
     * @param params The request's parameter.
     * @param token An optional cancellation token.
     * @returns A promise resolving to the request's result.
     */
    sendRequest<P, R, E, RO>(type: RequestType<P, R, E, RO>, params: P, token?: CancellationToken): Promise<R>;
    /**
     * Sends a request and returns a promise resolving to the result of the request.
     *
     * @param method the request's method name.
     * @param token An optional cancellation token.
     * @returns A promise resolving to the request's result.
     */
    sendRequest<R>(method: string, token?: CancellationToken): Promise<R>;
    /**
     * Sends a request and returns a promise resolving to the result of the request.
     *
     * @param method the request's method name.
     * @param params The request's parameter.
     * @param token An optional cancellation token.
     * @returns A promise resolving to the request's result.
     */
    // tslint:disable-next-line: no-any
    sendRequest<R>(method: string, param: any, token?: CancellationToken): Promise<R>;
    /**
     * Installs a request handler.
     *
     * @param type The request type to install the handler for.
     * @param handler The actual handler.
     */
    onRequest<R, E, RO>(type: RequestType0<R, E, RO>, handler: RequestHandler0<R, E>): void;
    /**
     * Installs a request handler.
     *
     * @param type The request type to install the handler for.
     * @param handler The actual handler.
     */
    onRequest<P, R, E, RO>(type: RequestType<P, R, E, RO>, handler: RequestHandler<P, R, E>): void;
    /**
     * Installs a request handler.
     *
     * @param methods The method name to install the handler for.
     * @param handler The actual handler.
     */
    onRequest<R, E>(method: string, handler: GenericRequestHandler<R, E>): void;
    /**
     * Sends a notification.
     *
     * @param type the notification's type to send.
     */
    sendNotification<RO>(type: NotificationType0<RO>): void;
    /**
     * Sends a notification.
     *
     * @param type the notification's type to send.
     * @param params the notification's parameters.
     */
    sendNotification<P, RO>(type: NotificationType<P, RO>, params?: P): void;
    /**
     * Sends a notification.
     *
     * @param method the notification's method name.
     */
    sendNotification(method: string): void;
    /**
     * Sends a notification.
     *
     * @param method the notification's method name.
     * @param params the notification's parameters.
     */
    // tslint:disable-next-line: unified-signatures no-any
    sendNotification(method: string, params: any): void;
    /**
     * Installs a notification handler.
     *
     * @param type The notification type to install the handler for.
     * @param handler The actual handler.
     */
    onNotification<RO>(type: NotificationType0<RO>, handler: NotificationHandler0): void;
    /**
     * Installs a notification handler.
     *
     * @param type The notification type to install the handler for.
     * @param handler The actual handler.
     */
    onNotification<P, RO>(type: NotificationType<P, RO>, handler: NotificationHandler<P>): void;
    /**
     * Installs a notification handler.
     *
     * @param methods The method name to install the handler for.
     * @param handler The actual handler.
     */
    onNotification(method: string, handler: GenericNotificationHandler): void;
    /**
     * Installs a progress handler for a given token.
     * @param type the progress type
     * @param token the token
     * @param handler the handler
     */
    onProgress<P>(type: ProgressType<P>, token: string | number, handler: NotificationHandler<P>): Disposable;
    /**
     * Sends progress.
     * @param type the progress type
     * @param token the token to use
     * @param value the progress value
     */
    sendProgress<P>(type: ProgressType<P>, token: string | number, value: P): void;
}

export interface ILanguageServer extends Disposable {
    readonly connection: ILanguageServerConnection;
    readonly capabilities: vscodeprotocol.ServerCapabilities;
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
