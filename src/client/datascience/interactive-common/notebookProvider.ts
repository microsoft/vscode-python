// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { CancellationError } from '../../common/cancellation';
import { traceInfo } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Identifiers, Settings, Telemetry } from '../constants';
import { JupyterInstallError } from '../jupyter/jupyterInstallError';
import { JupyterSelfCertsError } from '../jupyter/jupyterSelfCertsError';
import { JupyterZMQBinariesNotFoundError } from '../jupyter/jupyterZMQBinariesNotFoundError';
import { ProgressReporter } from '../progress/progressReporter';
import {
    GetNotebookOptions,
    GetServerOptions,
    IInteractiveWindowProvider,
    IJupyterExecution,
    INotebook,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookProvider,
    INotebookServer,
    INotebookServerOptions
} from '../types';

@injectable()
export class NotebookProvider implements INotebookProvider {
    private readonly notebooks = new Map<string, Promise<INotebook>>();
    private serverPromise: Promise<INotebookServer | undefined> | undefined;
    private allowingUI = false;
    constructor(
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter,
        @inject(IConfigurationService) private readonly configuration: IConfigurationService,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private readonly interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IJupyterExecution) private readonly jupyterExecution: IJupyterExecution,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService
    ) {
        disposables.push(editorProvider.onDidCloseNotebookEditor(this.onDidCloseNotebookEditor, this));
        disposables.push(
            interactiveWindowProvider.onDidChangeActiveInteractiveWindow(this.checkAndDisposeNotebook, this)
        );
    }

    public async getOrCreateServer(options: GetServerOptions): Promise<INotebookServer | undefined> {
        const serverOptions = this.getNotebookServerOptions();

        // If we are just fetching or only want to create for local, see if exists
        if (options.getOnly || (options.localOnly && serverOptions.uri)) {
            return this.jupyterExecution.getServer(serverOptions);
        } else {
            // Otherwise create a new server
            return this.createServer(options);
        }
    }

    public async getOrCreateNotebook(options: GetNotebookOptions): Promise<INotebook | undefined> {
        // Make sure we have a server
        const server = await this.getOrCreateServer({ getOnly: options.getOnly, disableUI: options.disableUI });
        if (server) {
            // We could have multiple native editors opened for the same file/model.
            const notebook = await server.getNotebook(options.identity);
            if (notebook) {
                return notebook;
            }

            if (this.notebooks.get(options.identity.fsPath)) {
                return this.notebooks.get(options.identity.fsPath)!!;
            }

            const promise = server.createNotebook(options.identity, options.identity, options.metadata);
            this.notebooks.set(options.identity.fsPath, promise);

            // Remove promise from cache if the same promise still exists.
            const removeFromCache = () => {
                const cachedPromise = this.notebooks.get(options.identity.fsPath);
                if (cachedPromise === promise) {
                    this.notebooks.delete(options.identity.fsPath);
                }
            };

            // If the notebook is disposed, remove from cache.
            promise.then(nb => nb.onDisposed(removeFromCache)).catch(noop);

            // If promise fails, then remove the promise from cache.
            promise.catch(removeFromCache);

            return promise;
        }
    }

    private async createServer(options: GetServerOptions): Promise<INotebookServer | undefined> {
        // When we finally try to create a server, update our flag indicating if we're going to allow UI or not. This
        // allows the server to be attempted without a UI, but a future request can come in and use the same startup
        this.allowingUI = options.disableUI ? this.allowingUI : true;

        if (!this.serverPromise) {
            // Start a server
            this.serverPromise = this.startServer();
        }
        try {
            return await this.serverPromise;
        } catch (e) {
            // Don't cache the error
            this.serverPromise = undefined;
            throw e;
        }
    }

    private async startServer(): Promise<INotebookServer | undefined> {
        const serverOptions = this.getNotebookServerOptions();

        traceInfo(`Checking for server existence.`);

        // Status depends upon if we're about to connect to existing server or not.
        const progressReporter = this.allowingUI
            ? (await this.jupyterExecution.getServer(serverOptions))
                ? this.progressReporter.createProgressIndicator(localize.DataScience.connectingToJupyter())
                : this.progressReporter.createProgressIndicator(localize.DataScience.startingJupyter())
            : undefined;

        // Check to see if we support ipykernel or not
        try {
            traceInfo(`Checking for server usability.`);

            const usable = await this.checkUsable(serverOptions);
            if (!usable) {
                traceInfo('Server not usable (should ask for install now)');
                // Indicate failing.
                throw new JupyterInstallError(
                    localize.DataScience.jupyterNotSupported().format(await this.jupyterExecution.getNotebookError()),
                    localize.DataScience.pythonInteractiveHelpLink()
                );
            }
            // Then actually start the server
            traceInfo(`Starting notebook server.`);
            const result = await this.jupyterExecution.connectToNotebookServer(serverOptions, progressReporter?.token);
            traceInfo(`Server started.`);
            return result;
        } catch (e) {
            progressReporter?.dispose();
            // If user cancelled, then do nothing.
            if (progressReporter && progressReporter.token.isCancellationRequested && e instanceof CancellationError) {
                return;
            }

            // Also tell jupyter execution to reset its search. Otherwise we've just cached
            // the failure there
            await this.jupyterExecution.refreshCommands();

            if (e instanceof JupyterSelfCertsError) {
                // On a self cert error, warn the user and ask if they want to change the setting
                const enableOption: string = localize.DataScience.jupyterSelfCertEnable();
                const closeOption: string = localize.DataScience.jupyterSelfCertClose();
                this.applicationShell
                    .showErrorMessage(
                        localize.DataScience.jupyterSelfCertFail().format(e.message),
                        enableOption,
                        closeOption
                    )
                    .then(value => {
                        if (value === enableOption) {
                            sendTelemetryEvent(Telemetry.SelfCertsMessageEnabled);
                            this.configuration
                                .updateSetting(
                                    'dataScience.allowUnauthorizedRemoteConnection',
                                    true,
                                    undefined,
                                    ConfigurationTarget.Workspace
                                )
                                .ignoreErrors();
                        } else if (value === closeOption) {
                            sendTelemetryEvent(Telemetry.SelfCertsMessageClose);
                        }
                    });
                throw e;
            } else {
                throw e;
            }
        } finally {
            progressReporter?.dispose();
        }
    }

    private async checkUsable(options: INotebookServerOptions): Promise<boolean> {
        let activeInterpreter: PythonInterpreter | undefined;
        try {
            if (options && !options.uri) {
                activeInterpreter = await this.interpreterService.getActiveInterpreter(undefined);
                const usableInterpreter = await this.jupyterExecution.getUsableJupyterPython();
                return usableInterpreter ? true : false;
            } else {
                return true;
            }
        } catch (e) {
            if (e instanceof JupyterZMQBinariesNotFoundError) {
                throw e;
            }
            // Can't find a usable interpreter, show the error.
            if (activeInterpreter) {
                const displayName = activeInterpreter.displayName
                    ? activeInterpreter.displayName
                    : activeInterpreter.path;
                throw new Error(
                    localize.DataScience.jupyterNotSupportedBecauseOfEnvironment().format(displayName, e.toString())
                );
            } else {
                throw new JupyterInstallError(
                    localize.DataScience.jupyterNotSupported().format(await this.jupyterExecution.getNotebookError()),
                    localize.DataScience.pythonInteractiveHelpLink()
                );
            }
        }
    }

    private getNotebookServerOptions(): INotebookServerOptions {
        // Since there's one server per session, don't use a resource to figure out these settings
        const settings = this.configuration.getSettings(undefined);
        let serverURI: string | undefined = settings.datascience.jupyterServerURI;
        const useDefaultConfig: boolean | undefined = settings.datascience.useDefaultConfigForJupyter;

        // For the local case pass in our URI as undefined, that way connect doesn't have to check the setting
        if (serverURI.toLowerCase() === Settings.JupyterServerLocalLaunch) {
            serverURI = undefined;
        }

        return {
            uri: serverURI,
            skipUsingDefaultConfig: !useDefaultConfig,
            purpose: Identifiers.HistoryPurpose,
            allowUI: this.allowUI.bind(this)
        };
    }

    private allowUI(): boolean {
        return this.allowingUI;
    }

    private async onDidCloseNotebookEditor(editor: INotebookEditor) {
        // First find all notebooks associated with this editor (ipynb file).
        const editors = this.editorProvider.editors.filter(
            e => this.fs.arePathsSame(e.file.fsPath, editor.file.fsPath) && e !== editor
        );

        // If we have no editors for this file, then dispose the notebook.
        if (editors.length === 0) {
            await this.disposeNotebook(editor.file);
        }
    }

    /**
     * Interactive windows have just one window.
     * When that it closed, just close all of the notebooks associated with interactive windows.
     */
    private checkAndDisposeNotebook() {
        if (this.interactiveWindowProvider.getActive()) {
            return;
        }

        Array.from(this.notebooks.values()).forEach(promise => {
            promise.then(notebook => notebook.dispose()).catch(noop);
        });

        this.notebooks.clear();
    }

    private async disposeNotebook(resource: Uri) {
        // First find all notebooks associated with this editor (ipynb file).
        const notebookPromise = this.notebooks.get(resource.fsPath);
        if (!notebookPromise) {
            // Possible it was closed before a notebook could be created.
            return;
        }
        this.notebooks.delete(resource.fsPath);
        const notebook = await notebookPromise.catch(noop);
        if (!notebook) {
            return;
        }

        await notebook.dispose().catch(noop);
    }
}
