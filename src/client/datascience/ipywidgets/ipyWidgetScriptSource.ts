// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import type * as jupyterlabService from '@jupyterlab/services';
import type * as serialize from '@jupyterlab/services/lib/kernel/serialize';
import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import { Event, EventEmitter, Uri } from 'vscode';
import type { Data as WebSocketData } from 'ws';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IHttpClient, IPersistentStateFactory } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import {
    INotebookIdentity,
    InteractiveWindowMessages,
    IPyWidgetMessages
} from '../interactive-common/interactiveWindowTypes';
import {
    IInteractiveWindowListener,
    ILocalResourceUriConverter,
    INotebook,
    INotebookProvider,
    KernelSocketInformation
} from '../types';
import { IPyWidgetScriptSourceProvider } from './ipyWidgetScriptSourceProvider';
import { WidgetScriptSource } from './types';

@injectable()
export class IPyWidgetScriptSource implements IInteractiveWindowListener, ILocalResourceUriConverter {
    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }
    // tslint:disable-next-line: no-any
    public get postInternalMessage(): Event<{ message: string; payload: any }> {
        return this.postInternalMessageEmitter.event;
    }
    private notebookIdentity?: Uri;
    private postEmitter = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    private postInternalMessageEmitter = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    private notebook?: INotebook;
    private jupyterLab?: typeof jupyterlabService;
    private scriptProvider?: IPyWidgetScriptSourceProvider;
    private disposables: IDisposable[] = [];
    private interpreterForWhichWidgetSourcesWereFetched?: PythonInterpreter;
    private kernelSocketInfo?: KernelSocketInformation;
    private subscribedToKernelSocket: boolean = false;
    /**
     * Key value pair of widget modules along with the version that needs to be loaded.
     */
    private pendingModuleRequests = new Map<string, string>();
    private jupyterSerialize?: typeof serialize;
    private get deserialize(): typeof serialize.deserialize {
        if (!this.jupyterSerialize) {
            // tslint:disable-next-line: no-require-imports
            this.jupyterSerialize = require('@jupyterlab/services/lib/kernel/serialize') as typeof serialize;
        }
        return this.jupyterSerialize.deserialize;
    }
    private readonly uriConversionPromises = new Map<string, Deferred<Uri>>();
    constructor(
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IConfigurationService) private readonly configurationSettings: IConfigurationService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory
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
    public asWebviewUri(localResource: Uri): Promise<Uri> {
        const key = localResource.toString();
        if (!this.uriConversionPromises.has(key)) {
            this.uriConversionPromises.set(key, createDeferred<Uri>());
            // Send a request for the translation.
            this.postInternalMessageEmitter.fire({
                message: InteractiveWindowMessages.ConvertUriForUseInWebViewRequest,
                payload: localResource
            });
        }
        return this.uriConversionPromises.get(key)!.promise;
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
        } else if (message === InteractiveWindowMessages.ConvertUriForUseInWebViewResponse) {
            const response: undefined | { request: Uri; response: Uri } = payload;
            if (response && this.uriConversionPromises.get(response.request.toString())) {
                this.uriConversionPromises.get(response.request.toString())!.resolve(response.response);
            }
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
     * Send the widget script source for a specific widget module & version.
     * This is a request made when a widget is certainly used in a notebook.
     */
    private async sendWidgetSource(moduleName: string, moduleVersion: string) {
        // Standard widgets area already available, hence no need to look for them.
        if (moduleName.startsWith('@jupyter') || moduleName === 'azureml_widgets') {
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
        if (this.scriptProvider) {
            return;
        }
        this.scriptProvider = new IPyWidgetScriptSourceProvider(
            this.notebook,
            this,
            this.fs,
            this.interpreterService,
            this.appShell,
            this.configurationSettings,
            this.workspaceService,
            this.stateFactory,
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
            },
            this,
            this.disposables
        );
        this.handlePendingRequests();
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
