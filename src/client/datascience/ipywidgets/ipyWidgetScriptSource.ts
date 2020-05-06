// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import type * as jupyterlabService from '@jupyterlab/services';
import { sha256 } from 'hash.js';
import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import * as path from 'path';
import { Event, EventEmitter, Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { traceError, traceInfo } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExtensionContext,
    IHttpClient,
    IPersistentStateFactory
} from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { getOSType, OSType } from '../../common/utils/platform';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import {
    INotebookIdentity,
    InteractiveWindowMessages,
    IPyWidgetMessages
} from '../interactive-common/interactiveWindowTypes';
import { IInteractiveWindowListener, ILocalResourceUriConverter, INotebook, INotebookProvider } from '../types';
import { IPyWidgetScriptSourceProvider } from './ipyWidgetScriptSourceProvider';
import { WidgetScriptSource } from './types';
// tslint:disable: no-var-requires no-require-imports
const sanitize = require('sanitize-filename');

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
    private readonly resourcesMappedToExtensionFolder = new Map<string, Promise<Uri>>();
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
    /**
     * Key value pair of widget modules along with the version that needs to be loaded.
     */
    private pendingModuleRequests = new Map<string, string | undefined>();
    private readonly uriConversionPromises = new Map<string, Deferred<Uri>>();
    private readonly targetWidgetScriptsFolder: string;
    private readonly _rootScriptFolder: string;
    private readonly createTargetWidgetScriptsFolder: Promise<string>;
    constructor(
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IConfigurationService) private readonly configurationSettings: IConfigurationService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory,
        @inject(IExtensionContext) extensionContext: IExtensionContext
    ) {
        this._rootScriptFolder = path.join(extensionContext.extensionPath, 'tmp', 'scripts');
        this.targetWidgetScriptsFolder = path.join(this._rootScriptFolder, 'nbextensions');
        this.createTargetWidgetScriptsFolder = this.fs
            .directoryExists(this.targetWidgetScriptsFolder)
            .then(async (exists) => {
                if (!exists) {
                    await this.fs.createDirectory(this.targetWidgetScriptsFolder);
                }
                return this.targetWidgetScriptsFolder;
            });
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
    /**
     * This method is called to convert a Uri to a format such that it can be used in a webview.
     * WebViews only allow files that are part of extension and the same directory where notebook lives.
     * To ensure widgets can find the js files, we copy the script file to a into the extensionr folder  `tmp/nbextensions`.
     * (storing files in `tmp/nbextensions` is relatively safe as this folder gets deleted when ever a user updates to a new version of VSC).
     * Hence we need to copy for every version of the extension.
     * Copying into global workspace folder would also work, but over time this folder size could grow (in an unmanaged way).
     */
    public async asWebviewUri(localResource: Uri): Promise<Uri> {
        // Make a copy of the local file if not already in the correct location
        if (!this.isInScriptPath(localResource.fsPath)) {
            if (this.notebookIdentity && !this.resourcesMappedToExtensionFolder.has(localResource.fsPath)) {
                const deferred = createDeferred<Uri>();
                this.resourcesMappedToExtensionFolder.set(localResource.fsPath, deferred.promise);
                try {
                    // Create a file name such that it will be unique and consistent across VSC reloads.
                    // Only if original file has been modified should we create a new copy of the sam file.
                    const fileHash: string = await this.fs.getFileHash(localResource.fsPath);
                    const uniqueFileName = sanitize(
                        sha256().update(`${localResource.fsPath}${fileHash}`).digest('hex')
                    );
                    const targetFolder = await this.createTargetWidgetScriptsFolder;
                    const mappedResource = Uri.file(
                        path.join(targetFolder, `${uniqueFileName}${path.basename(localResource.fsPath)}`)
                    );
                    if (!(await this.fs.fileExists(mappedResource.fsPath))) {
                        await this.fs.copyFile(localResource.fsPath, mappedResource.fsPath);
                    }
                    traceInfo(`Widget Script file ${localResource.fsPath} mapped to ${mappedResource.fsPath}`);
                    deferred.resolve(mappedResource);
                } catch (ex) {
                    traceError(`Failed to map widget Script file ${localResource.fsPath}`);
                    deferred.reject(ex);
                }
            }
            localResource = await this.resourcesMappedToExtensionFolder.get(localResource.fsPath)!;
        }
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

    public get rootScriptFolder(): Uri {
        return Uri.file(this._rootScriptFolder);
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
        } else if (message === InteractiveWindowMessages.NotebookClose) {
            this.dispose();
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
    private async sendWidgetSource(moduleName?: string, moduleVersion: string = '*') {
        // Standard widgets area already available, hence no need to look for them.
        if (!moduleName || moduleName.startsWith('@jupyter')) {
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
        this.notebookIdentity = args.resource;
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

    private isInScriptPath(filePath: string) {
        const scriptPath = path.normalize(this._rootScriptFolder);
        filePath = path.normalize(filePath);
        if (getOSType() === OSType.Windows) {
            return filePath.toUpperCase().startsWith(scriptPath.toUpperCase());
        } else {
            return filePath.startsWith(scriptPath);
        }
    }
}
