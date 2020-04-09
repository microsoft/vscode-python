// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import type * as jupyterlabService from '@jupyterlab/services';
import type * as serlialize from '@jupyterlab/services/lib/kernel/serialize';
import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import { Event, EventEmitter, Uri } from 'vscode';
import type { Data as WebSocketData } from 'ws';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IHttpClient } from '../../common/types';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import {
    INotebookIdentity,
    InteractiveWindowMessages,
    IPyWidgetMessages
} from '../interactive-common/interactiveWindowTypes';
import {
    IInteractiveBase,
    IInteractiveWindowListener,
    IInteractiveWindowProvider,
    INotebook,
    INotebookEditorProvider,
    INotebookProvider,
    KernelSocketInformation
} from '../types';
import { IPyWidgetScriptSourceProvider } from './ipyWidgetScriptSourceProvider';
import { WidgetScriptSource } from './types';

@injectable()
export class IPyWidgetScriptSource implements IInteractiveWindowListener {
    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }
    private notebookIdentity?: Uri;
    private postEmitter = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    private notebook?: INotebook;
    private jupyterLab?: typeof jupyterlabService;
    private interactiveBase?: IInteractiveBase;
    private scriptProvider?: IPyWidgetScriptSourceProvider;
    private disposables: IDisposable[] = [];
    private interpreterForWhichWidgetSourcesWereFetched?: PythonInterpreter;
    private kernelSocketInfo?: KernelSocketInformation;
    private subscribedToKernelSocket: boolean = false;
    /**
     * Key value pair of widget modules along with the version that needs to be loaded.
     */
    private pendingModuleRequests = new Map<string, string>();
    private jupyterSerialize?: typeof serlialize;
    private get deserialize(): typeof serlialize.deserialize {
        if (!this.jupyterSerialize) {
            // tslint:disable-next-line: no-require-imports
            this.jupyterSerialize = require('@jupyterlab/services/lib/kernel/serialize') as typeof serlialize;
        }
        return this.jupyterSerialize.deserialize;
    }
    constructor(
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private readonly interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IConfigurationService) private readonly configurationSettings: IConfigurationService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) {
        disposables.push(this);
        this.notebookProvider.onNotebookCreated(
            (e) => {
                if (e.identity.toString() === this.notebookIdentity?.toString()) {
                    this.initialize().catch(traceError.bind('Failed to initialize'));
                }
            },
            this,
            this.disposables
        );
    }

    public dispose() {
        while (this.disposables.length) {
            this.disposables.shift()?.dispose(); // NOSONAR
        }
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload?: any): void {
        if (message === InteractiveWindowMessages.NotebookIdentity) {
            this.saveIdentity(payload).catch((ex) =>
                traceError(`Failed to initialize ${(this as Object).constructor.name}`, ex)
            );
        } else if (message === IPyWidgetMessages.IPyWidgets_Ready) {
            this.sendListOfWidgetSources().catch(traceError.bind('Failed to send widget sources upon ready'));
        } else if (message === IPyWidgetMessages.IPyWidgets_AllWidgetScriptSourcesRequest) {
            this.sendListOfWidgetSources().catch(traceError.bind('Failed to send widget sources upon ready'));
        } else if (message === IPyWidgetMessages.IPyWidgets_WidgetScriptSourceRequest) {
            if (payload) {
                const { moduleName, moduleVersion } = payload as { moduleName: string; moduleVersion: string };
                this.sendWidgetSource(moduleName, moduleVersion).catch(
                    traceError.bind('Failed to send widget sources upon ready')
                );
            }
        }
    }

    /**
     * Send a list of all widgets and sources to the UI.
     * Used to pre-emptively register widgets with requirejs, even if they are not used.
     * (this is merely a perf optimization).
     */
    private async sendListOfWidgetSources(ignoreCache?: boolean) {
        if (!this.notebook || !this.scriptProvider) {
            return;
        }

        const sources = await this.scriptProvider.getWidgetScriptSources(ignoreCache);
        this.postEmitter.fire({
            message: IPyWidgetMessages.IPyWidgets_AllWidgetScriptSourcesResponse,
            payload: sources
        });
    }
    /**
     * Send the widget script source for a specific widget module & version.
     * This is a request made when a widget is certainly used in a notebook.
     */
    private async sendWidgetSource(moduleName: string, moduleVersion: string) {
        // Standard widgets area already available, hence no need to look for them.
        if (moduleName.startsWith('@jupyter')) {
            return;
        }
        if (!this.notebook || !this.scriptProvider) {
            this.pendingModuleRequests.set(moduleName, moduleVersion);
            return;
        }

        let widgetSource: WidgetScriptSource = { moduleName };
        try {
            widgetSource = await this.scriptProvider.getWidgetScriptSource(moduleName, moduleVersion);
        } catch (ex) {
            traceError('Failed to get widget source due to an error', ex);
            sendTelemetryEvent(Telemetry.HashedIPyWidgetScriptDiscoveryError);
        } finally {
            // Send to UI (even if there's an error) continues instead of hanging while waiting for a response.
            this.postEmitter.fire({
                message: IPyWidgetMessages.IPyWidgets_WidgetScriptSourceResponse,
                payload: widgetSource
            });
        }
    }
    private async saveIdentity(args: INotebookIdentity) {
        this.notebookIdentity = Uri.parse(args.resource);
        await this.initialize();
    }

    private async initialize() {
        if (!this.jupyterLab) {
            // Lazy load jupyter lab for faster extension loading.
            // tslint:disable-next-line:no-require-imports
            this.jupyterLab = require('@jupyterlab/services') as typeof jupyterlabService; // NOSONAR
        }

        if (!this.notebookIdentity) {
            return;
        }
        if (!this.notebook) {
            this.notebook = await this.notebookProvider.getOrCreateNotebook({
                identity: this.notebookIdentity,
                disableUI: true,
                getOnly: true
            });
        }
        if (!this.notebook) {
            return;
        }
        if (!this.interactiveBase) {
            this.interactiveBase = this.notebookEditorProvider.editors.find(
                (editor) =>
                    editor.notebook?.identity.toString() === this.notebookIdentity?.toString() ||
                    editor.file.toString() === this.notebookIdentity?.toString()
            );
            if (!this.interactiveBase) {
                this.interactiveBase = this.interactiveWindowProvider.getActive();
            }
        }
        if (!this.interactiveBase) {
            return;
        }
        if (this.scriptProvider) {
            return;
        }
        this.scriptProvider = new IPyWidgetScriptSourceProvider(
            this.notebook,
            this.interactiveBase,
            this.fs,
            this.interpreterService,
            this.appShell,
            this.configurationSettings,
            this.workspaceService,
            this.httpClient
        );
        await this.initializeNotebook();
    }
    private async initializeNotebook() {
        if (!this.notebook) {
            return;
        }
        this.subscribeToKernelSocket();
        this.notebook.onDisposed(() => this.dispose());
        // When changing a kernel, we might have a new interpreter.
        this.notebook.onKernelChanged(
            () => {
                // If underlying interpreter has changed, then refresh list of widget sources.
                // After all, different kernels have different widgets.
                if (
                    this.notebook?.getMatchingInterpreter() &&
                    this.notebook?.getMatchingInterpreter() === this.interpreterForWhichWidgetSourcesWereFetched
                ) {
                    return;
                }
                // Let UI know that kernel has changed.
                this.postEmitter.fire({ message: IPyWidgetMessages.IPyWidgets_onKernelChanged, payload: undefined });
                this.sendListOfWidgetSources(true).catch(traceError.bind('Failed to refresh widget sources'));
            },
            this,
            this.disposables
        );
        // Kernel restarts are required when user installs new packages, possible a new widget/package was installed.
        this.notebook.onKernelRestarted(
            () => this.sendListOfWidgetSources(true).catch(traceError.bind('Failed to refresh widget sources')),
            this,
            this.disposables
        );
        this.handlePendingRequests();
        this.sendListOfWidgetSources().catch(traceError.bind('Failed to send initial list of Widget Sources'));
    }
    private subscribeToKernelSocket() {
        if (this.subscribedToKernelSocket || !this.notebook) {
            return;
        }
        this.subscribedToKernelSocket = true;
        // Listen to changes to kernel socket (e.g. restarts or changes to kernel).
        this.notebook.kernelSocket.subscribe((info) => {
            // Remove old handlers.
            this.kernelSocketInfo?.socket?.removeReceiveHook(this.onKernelSocketMessage.bind(this)); // NOSONAR

            if (!info || !info.socket) {
                // No kernel socket information, hence nothing much we can do.
                this.kernelSocketInfo = undefined;
                return;
            }

            this.kernelSocketInfo = info;
            this.kernelSocketInfo.socket?.addReceiveHook(this.onKernelSocketMessage.bind(this)); // NOSONAR
        });
    }
    /**
     * If we get a comm open message, then we know a widget will be displayed.
     * In this case get hold of the name and send it up (pre-fetch it before UI makes a request for it).
     */
    private async onKernelSocketMessage(message: WebSocketData): Promise<void> {
        // tslint:disable-next-line: no-any
        const msg = this.deserialize(message as any);
        if (this.jupyterLab?.KernelMessage.isCommOpenMsg(msg) && msg.content.target_module) {
            this.sendWidgetSource(msg.content.target_module, '').catch(
                traceError.bind('Failed to pre-load Widget Script')
            );
        } else if (
            this.jupyterLab?.KernelMessage.isCommOpenMsg(msg) &&
            msg.content.data &&
            msg.content.data.state &&
            // tslint:disable-next-line: no-any
            ((msg.content.data.state as any)._view_module || (msg.content.data.state as any)._model_module)
        ) {
            // tslint:disable-next-line: no-any
            const viewModule: string = (msg.content.data.state as any)._view_module;
            // tslint:disable-next-line: no-any
            const viewModuleVersion: string = (msg.content.data.state as any)._view_module_version;
            // tslint:disable-next-line: no-any
            const modelModule = (msg.content.data.state as any)._model_module;
            // tslint:disable-next-line: no-any
            const modelModuleVersion = (msg.content.data.state as any)._model_module_version;
            if (viewModule) {
                this.sendWidgetSource(viewModule, modelModuleVersion || '').catch(
                    traceError.bind('Failed to pre-load Widget Script')
                );
            }
            if (modelModule) {
                this.sendWidgetSource(viewModule, viewModuleVersion || '').catch(
                    traceError.bind('Failed to pre-load Widget Script')
                );
            }
        }
    }
    private handlePendingRequests() {
        const pendingModuleNames = Array.from(this.pendingModuleRequests.keys());
        while (pendingModuleNames.length) {
            const moduleName = pendingModuleNames.shift();
            if (moduleName) {
                const moduleVersion = this.pendingModuleRequests.get(moduleName)!;
                this.pendingModuleRequests.delete(moduleName);
                this.sendWidgetSource(moduleName, moduleVersion).catch(
                    traceError.bind(`Failed to send WidgetScript for ${moduleName}`)
                );
            }
        }
    }
}
