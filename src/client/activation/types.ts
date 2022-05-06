// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    CodeLensProvider,
    CompletionItemProvider,
    DefinitionProvider,
    DocumentSymbolProvider,
    Event,
    HoverProvider,
    ReferenceProvider,
    RenameProvider,
    SignatureHelpProvider,
} from 'vscode';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient/node';
import * as lsp from 'vscode-languageserver-protocol';
import type { IDisposable, IOutputChannel, Resource } from '../common/types';
import { PythonEnvironment } from '../pythonEnvironments/info';

export const IExtensionActivationManager = Symbol('IExtensionActivationManager');
/**
 * Responsible for activation of extension.
 *
 * @export
 * @interface IExtensionActivationManager
 * @extends {IDisposable}
 */
export interface IExtensionActivationManager extends IDisposable {
    /**
     * Method invoked when extension activates (invoked once).
     *
     * @returns {Promise<void>}
     * @memberof IExtensionActivationManager
     */
    activate(): Promise<void>;
    /**
     * Method invoked when a workspace is loaded.
     * This is where we place initialization scripts for each workspace.
     * (e.g. if we need to run code for each workspace, then this is where that happens).
     *
     * @param {Resource} resource
     * @returns {Promise<void>}
     * @memberof IExtensionActivationManager
     */
    activateWorkspace(resource: Resource): Promise<void>;
}

export const IExtensionActivationService = Symbol('IExtensionActivationService');
/**
 * Classes implementing this interface will have their `activate` methods
 * invoked for every workspace folder (in multi-root workspace folders) during the activation of the extension.
 * This is a great hook for extension activation code, i.e. you don't need to modify
 * the `extension.ts` file to invoke some code when extension gets activated.
 * @export
 * @interface IExtensionActivationService
 */
export interface IExtensionActivationService {
    supportedWorkspaceTypes: { untrustedWorkspace: boolean; virtualWorkspace: boolean };
    activate(resource: Resource): Promise<void>;
}

export enum LanguageServerType {
    Jedi = 'Jedi',
    JediLSP = 'JediLSP',
    Microsoft = 'Microsoft',
    Node = 'Pylance',
    None = 'None',
}

/**
 * This interface is a subset of the vscode-protocol connection interface.
 * It's the minimum set of functions needed in order to talk to a language server.
 */
export type ILanguageServerConnection = Pick<
    lsp.ProtocolConnection,
    'sendRequest' | 'sendNotification' | 'onProgress' | 'sendProgress' | 'onNotification' | 'onRequest'
>;

export interface ILanguageServer
    extends RenameProvider,
        DefinitionProvider,
        HoverProvider,
        ReferenceProvider,
        CompletionItemProvider,
        CodeLensProvider,
        DocumentSymbolProvider,
        SignatureHelpProvider,
        IDisposable {
    readonly connection?: ILanguageServerConnection;
    readonly capabilities?: lsp.ServerCapabilities;
}

export const ILanguageServerActivator = Symbol('ILanguageServerActivator');
export interface ILanguageServerActivator extends ILanguageServer {
    start(resource: Resource, interpreter: PythonEnvironment | undefined): Promise<void>;
    activate(): void;
    deactivate(): void;
}

export const ILanguageServerCache = Symbol('ILanguageServerCache');
export interface ILanguageServerCache {
    get(resource: Resource, interpreter?: PythonEnvironment): Promise<ILanguageServer>;
}

export const ILanguageClientFactory = Symbol('ILanguageClientFactory');
export interface ILanguageClientFactory {
    createLanguageClient(
        resource: Resource,
        interpreter: PythonEnvironment | undefined,
        clientOptions: LanguageClientOptions,
        env?: NodeJS.ProcessEnv,
    ): Promise<LanguageClient>;
}
export const ILanguageServerAnalysisOptions = Symbol('ILanguageServerAnalysisOptions');
export interface ILanguageServerAnalysisOptions extends IDisposable {
    readonly onDidChange: Event<void>;
    initialize(resource: Resource, interpreter: PythonEnvironment | undefined): Promise<void>;
    getAnalysisOptions(): Promise<LanguageClientOptions>;
}
export const ILanguageServerManager = Symbol('ILanguageServerManager');
export interface ILanguageServerManager extends IDisposable {
    readonly languageProxy: ILanguageServerProxy | undefined;
    start(resource: Resource, interpreter: PythonEnvironment | undefined): Promise<void>;
    connect(): void;
    disconnect(): void;
}

export const ILanguageServerProxy = Symbol('ILanguageServerProxy');
export interface ILanguageServerProxy extends IDisposable {
    /**
     * LanguageClient in use
     */
    languageClient: LanguageClient | undefined;
    start(
        resource: Resource,
        interpreter: PythonEnvironment | undefined,
        options: LanguageClientOptions,
    ): Promise<void>;
    stop(): Promise<void>;
    /**
     * Sends a request to LS so as to load other extensions.
     * This is used as a plugin loader mechanism.
     * Anyone (such as intellicode) wanting to interact with LS, needs to send this request to LS.
     * @param {{}} [args]
     * @memberof ILanguageServerProxy
     */
    loadExtension(args?: unknown): void;
}

export const ILanguageServerOutputChannel = Symbol('ILanguageServerOutputChannel');
export interface ILanguageServerOutputChannel {
    /**
     * Creates output channel if necessary and returns it
     *
     * @type {IOutputChannel}
     * @memberof ILanguageServerOutputChannel
     */
    readonly channel: IOutputChannel;
}

export const IExtensionSingleActivationService = Symbol('IExtensionSingleActivationService');
/**
 * Classes implementing this interface will have their `activate` methods
 * invoked during the activation of the extension.
 * This is a great hook for extension activation code, i.e. you don't need to modify
 * the `extension.ts` file to invoke some code when extension gets activated.
 * @export
 * @interface IExtensionSingleActivationService
 */
export interface IExtensionSingleActivationService {
    supportedWorkspaceTypes: { untrustedWorkspace: boolean; virtualWorkspace: boolean };
    activate(): Promise<void>;
}
