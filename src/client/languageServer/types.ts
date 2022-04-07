// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ILanguageServer, ILanguageServerProxy, LanguageServerType } from '../activation/types';
import { Resource } from '../common/types';
import { PythonEnvironment } from '../pythonEnvironments/info';

export const ILanguageServerWatcher = Symbol('ILanguageServerWatcher');
/**
 * The language server watcher serves as a singleton that watches for changes to the language server setting,
 * and instantiates the relevant language server extension manager.
 */
export interface ILanguageServerWatcher {
    readonly languageServerExtensionManager: ILanguageServerExtensionManager | undefined;
    readonly languageServerType: LanguageServerType;
    startLanguageServer(languageServerType: LanguageServerType): Promise<void>;
}

export interface ILanguageServerCapabilities extends ILanguageServer {
    serverProxy: ILanguageServerProxy | undefined;

    get(): Promise<ILanguageServer>;
}

/**
 * Language server extension manager implementations act as a wrapper for anything related to their language server extension.
 * They are responsible for starting and stopping the language server provided by their LS extension.
 *
 * They also extend the ILanguageServer interface via ILanguageServerCapabilities to keep providing support to the Jupyter integration.
 */
export interface ILanguageServerExtensionManager extends ILanguageServerCapabilities {
    startLanguageServer(resource: Resource, interpreter?: PythonEnvironment): Promise<void>;
    stopLanguageServer(): void;
    canStartLanguageServer(): boolean;
    languageServerNotAvailable(): Promise<void>;
    dispose(): void;
}
