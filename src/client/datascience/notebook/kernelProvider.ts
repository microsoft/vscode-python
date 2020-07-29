// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { sha256 } from 'hash.js';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { CancellationToken, Event, EventEmitter, Uri } from 'vscode';
import {
    NotebookCommunication,
    NotebookDocument,
    NotebookKernel as VSCNotebookKernel,
    NotebookKernelProvider
} from '../../../../types/vscode-proposed';
import { IApplicationShell, IVSCodeNotebook, IWorkspaceService } from '../../common/application/types';
import { traceError, traceInfo } from '../../common/logger';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExtensionContext,
    IHttpClient,
    IPersistentStateFactory
} from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { getOSType, OSType } from '../../common/utils/platform';
import { IInterpreterService } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { IPyWidgetMessages } from '../interactive-common/interactiveWindowTypes';
import { IPyWidgetMessageDispatcherFactory } from '../ipywidgets/ipyWidgetMessageDispatcherFactory';
import { IPyWidgetScriptSourceProvider } from '../ipywidgets/ipyWidgetScriptSourceProvider';
import { IIPyWidgetMessageDispatcher, WidgetScriptSource } from '../ipywidgets/types';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { IDataScienceFileSystem, ILocalResourceUriConverter, INotebook, INotebookProvider } from '../types';
import { NotebookKernel } from './notebookKernel';
import { INotebookExecutionService } from './types';
// tslint:disable: no-var-requires no-require-imports
const sanitize = require('sanitize-filename');

@injectable()
export class KernelProvider implements NotebookKernelProvider, ILocalResourceUriConverter {
    public get onDidChangeKernels(): Event<void> {
        return this._onDidChangeKernels.event;
    }

    public get rootScriptFolder(): Uri {
        return Uri.file(this._rootScriptFolder);
    }
    private readonly _onDidChangeKernels = new EventEmitter<void>();

    private readonly dispatchers = new WeakMap<NotebookDocument, IIPyWidgetMessageDispatcher>();
    private scriptProvider?: IPyWidgetScriptSourceProvider;
    private jupyterNotebook?: INotebook;
    private readonly targetWidgetScriptsFolder: string;
    private readonly _rootScriptFolder: string;
    private readonly createTargetWidgetScriptsFolder: Promise<string>;
    private webview!: NotebookCommunication;
    private readonly resourcesMappedToExtensionFolder = new Map<string, Promise<Uri>>();
    private pendingModuleRequests = new Map<string, string | undefined>();
    constructor(
        @inject(IConfigurationService) private readonly configurationSettings: IConfigurationService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(INotebookExecutionService) private readonly execution: INotebookExecutionService,
        @inject(KernelSelectionProvider) private readonly kernelSelectionProvider: KernelSelectionProvider,
        @inject(IVSCodeNotebook) private readonly notebook: IVSCodeNotebook,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IPyWidgetMessageDispatcherFactory)
        private readonly widgetMessageDispatcherFactory: IPyWidgetMessageDispatcherFactory,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(INotebookStorageProvider) private readonly notebookStorage: INotebookStorageProvider,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory,
        @inject(IExtensionContext) extensionContext: IExtensionContext
    ) {
        this.kernelSelectionProvider.SelectionsChanged(() => this._onDidChangeKernels.fire(), this, disposables);
        this.notebook.onDidChangeActiveNotebookKernel(this.onDidChangeActiveNotebookKernel, this, disposables);
        this._rootScriptFolder = path.join(extensionContext.extensionPath, 'tmp', 'scripts');
        this.targetWidgetScriptsFolder = path.join(this._rootScriptFolder, 'nbextensions');
        this.createTargetWidgetScriptsFolder = this.fs
            .localDirectoryExists(this.targetWidgetScriptsFolder)
            .then(async (exists) => {
                if (!exists) {
                    await this.fs.createLocalDirectory(this.targetWidgetScriptsFolder);
                }
                return this.targetWidgetScriptsFolder;
            });
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
            if (!this.resourcesMappedToExtensionFolder.has(localResource.fsPath)) {
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
                    if (!(await this.fs.localFileExists(mappedResource.fsPath))) {
                        await this.fs.copyLocal(localResource.fsPath, mappedResource.fsPath);
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
        return this.webview.asWebviewUri(localResource);
    }
    /**
     * Called before running code against a kernel. An initialization phase.
     * If the selected kernel is being validated, we can block here.
     */
    public async resolveKernel(
        kernel: NotebookKernel,
        document: NotebookDocument,
        webview: NotebookCommunication,
        _token: CancellationToken
    ): Promise<void> {
        this.webview = webview;
        // if (process.env['1234']) {
        const model = await this.notebookStorage.get(document.uri, undefined, undefined, true);
        this.jupyterNotebook = await this.notebookProvider.getOrCreateNotebook({
            identity: document.uri,
            resource: document.uri,
            metadata: model.metadata,
            disableUI: false,
            getOnly: false
        });

        const dispatcher = this.getIPyWidgetMessageDispatcher(document);
        // this.getIPyWidgetMessageDispatcher(document);
        // await dispatcher.initialize();
        dispatcher.postMessage((e) => {
            webview.postMessage({ type: '__IPYWIDGET_KERNEL_MESSAGE', payload: e });
        });
        // }
        // return Promise.race([
        //     kernel.hasBeenValidated.promise,
        //     createPromiseFromCancellation({ cancelAction: 'resolve', token, defaultValue: void 0 })
        // ]);
        // tslint:disable-next-line: no-console
        console.error('Kernel', kernel);
        webview.postMessage({ type: 'fromKernel', payload: 'DataFromKernel' });
        webview.onDidReceiveMessage((msg) => {
            if (
                msg &&
                msg.type === '__IPYWIDGET_KERNEL_MESSAGE' &&
                (msg.payload.type === IPyWidgetMessages.IPyWidgets_WidgetScriptSourceRequest ||
                    msg.payload.message === IPyWidgetMessages.IPyWidgets_WidgetScriptSourceRequest)
            ) {
                this.sendWidgetSource(msg.payload.payload.moduleName, msg.payload.payload.moduleVersion).catch((ex) =>
                    // tslint:disable-next-line: no-console
                    console.error('Failed to get widget script source in kernelProvider.ts', ex)
                );
                return;
            }
            if (msg && msg.type === '__IPYWIDGET_KERNEL_MESSAGE') {
                dispatcher.receiveMessage(msg.payload);
            }
            // tslint:disable-next-line: no-console
            console.error(`Message from UI kernel`, msg);
        });
        // Let UI kernel know we are ready.
        webview.postMessage({ type: '__IPYWIDGET_BACKEND_READY' });
        return;
    }

    public async provideKernels(document: NotebookDocument, token: CancellationToken): Promise<NotebookKernel[]> {
        const [rawKernels] = await Promise.all([
            // this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'jupyter', undefined, token),
            this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'raw', undefined, token)
        ]);

        if (token.isCancellationRequested) {
            return [];
        }

        return rawKernels.map(
            (kernel) =>
                new NotebookKernel(kernel.label, kernel.description || '', false, kernel.selection, this.execution)
        );
        // )
        // .concat(
        //     jupyterKernels.map(
        //         (kernel) =>
        //             new NotebookKernel(
        //                 kernel.label,
        //                 kernel.description || '',
        //                 false,
        //                 kernel.selection,
        //                 this.execution
        //             )
        //     )
        // );
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
    private async sendWidgetSource(moduleName?: string, moduleVersion: string = '*') {
        // Standard widgets area already available, hence no need to look for them.
        if (!moduleName || moduleName.startsWith('@jupyter')) {
            return;
        }
        if (!this.notebook) {
            this.pendingModuleRequests.set(moduleName, moduleVersion);
            return;
        }

        let widgetSource: WidgetScriptSource = { moduleName };
        try {
            widgetSource = await this.getScriptProvider().getWidgetScriptSource(moduleName, moduleVersion);
        } catch (ex) {
            traceError('Failed to get widget source due to an error', ex);
            sendTelemetryEvent(Telemetry.HashedIPyWidgetScriptDiscoveryError);
        } finally {
            // Send to UI (even if there's an error) continues instead of hanging while waiting for a response.
            this.webview.postMessage({
                type: '__IPYWIDGET_KERNEL_MESSAGE',
                payload: { type: IPyWidgetMessages.IPyWidgets_WidgetScriptSourceResponse, payload: widgetSource }
            });
            // Send to UI (even if there's an error) continues instead of hanging while waiting for a response.
            this.webview.postMessage({
                type: '______1234_____',
                payload: 1234
            });
            this.webview.postMessage({
                type: '______1234_____',
                payload: 1234
            });
            this.webview.postMessage({
                type: '______1234_____',
                payload: 1234
            });
            this.webview.postMessage({
                type: '______1234_____',
                payload: 1234
            });
        }
    }
    private getScriptProvider() {
        if (!this.scriptProvider) {
            this.scriptProvider = new IPyWidgetScriptSourceProvider(
                this.jupyterNotebook!,
                this,
                this.fs,
                this.interpreterService,
                this.appShell,
                this.configurationSettings,
                this.workspaceService,
                this.stateFactory,
                this.httpClient
            );
        }
        return this.scriptProvider;
    }
    private getIPyWidgetMessageDispatcher(notebook: NotebookDocument) {
        if (!this.dispatchers.has(notebook)) {
            this.dispatchers.set(notebook, this.widgetMessageDispatcherFactory.create(notebook.uri));
        }
        return this.dispatchers.get(notebook)!;
    }
    private async onDidChangeActiveNotebookKernel(e: {
        document: NotebookDocument;
        kernel: VSCNotebookKernel | undefined;
    }) {
        if (!e.kernel || !(e.kernel instanceof NotebookKernel)) {
            return;
        }

        // Validate the selection.
        // currentKernel.hasBeenValidated.resolve();
    }
}
