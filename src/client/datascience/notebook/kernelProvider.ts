import { sha256 } from 'hash.js';
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import * as path from 'path';
// tslint:disable: no-var-requires no-require-imports
const sanitize = require('sanitize-filename');
import { CancellationToken, Event, EventEmitter, Uri } from 'vscode';
import {
    NotebookCell,
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
import { noop } from '../../common/utils/misc';
import { getOSType, OSType } from '../../common/utils/platform';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { IPyWidgetMessages } from '../interactive-common/interactiveWindowTypes';
import { IPyWidgetMessageDispatcherFactory } from '../ipywidgets/ipyWidgetMessageDispatcherFactory';
import { IPyWidgetScriptSourceProvider } from '../ipywidgets/ipyWidgetScriptSourceProvider';
import { IIPyWidgetMessageDispatcher, WidgetScriptSource } from '../ipywidgets/types';
import { areKernelConnectionsEqual } from '../jupyter/kernels/helpers';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import { IKernelProvider, KernelConnectionMetadata } from '../jupyter/kernels/types';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { IDataScienceFileSystem, ILocalResourceUriConverter, INotebook, INotebookProvider } from '../types';
import { getNotebookMetadata, isJupyterNotebook, updateKernelInNotebookMetadata } from './helpers/helpers';
import { IWebServer, WebServer } from './ipywidgets';
import { INotebookContentProvider } from './types';

class VSCodeNotebookKernelMetadata implements VSCNotebookKernel {
    get preloads(): Uri[] {
        return [
            Uri.file(path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'notebook', 'ipywidgets.js')),
            Uri.file(path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'renderers', 'ipywidgets.js'))
        ];
    }
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly selection: Readonly<KernelConnectionMetadata>,
        public readonly isPreferred: boolean,
        private readonly kernelProvider: IKernelProvider
    ) {}
    public executeCell(_: NotebookDocument, cell: NotebookCell) {
        this.kernelProvider.getOrCreate(cell.notebook.uri, { metadata: this.selection })?.executeCell(cell); // NOSONAR
    }
    public executeAllCells(document: NotebookDocument) {
        this.kernelProvider.getOrCreate(document.uri, { metadata: this.selection })?.executeAllCells(document); // NOSONAR
    }
    public cancelCellExecution(_: NotebookDocument, cell: NotebookCell) {
        this.kernelProvider.get(cell.notebook.uri)?.interrupt(); // NOSONAR
    }
    public cancelAllCellsExecution(document: NotebookDocument) {
        this.kernelProvider.get(document.uri)?.interrupt(); // NOSONAR
    }
}

@injectable()
export class VSCodeKernelPickerProvider implements NotebookKernelProvider, ILocalResourceUriConverter {
    public get onDidChangeKernels(): Event<void> {
        return this._onDidChangeKernels.event;
    }
    public get rootScriptFolder(): Uri {
        return Uri.file(this._rootScriptFolder);
    }
    private readonly _rootScriptFolder: string;
    private readonly _onDidChangeKernels = new EventEmitter<void>();
    private notebookKernelChangeHandled = new WeakSet<INotebook>();
    private readonly dispatchers = new WeakMap<NotebookDocument, IIPyWidgetMessageDispatcher>();
    private scriptProvider?: IPyWidgetScriptSourceProvider;
    private jupyterNotebook?: INotebook;
    private readonly targetWidgetScriptsFolder: string;
    private readonly createTargetWidgetScriptsFolder: Promise<string>;
    private webview!: NotebookCommunication;
    private readonly resourcesMappedToExtensionFolder = new Map<string, Promise<Uri>>();
    private pendingModuleRequests = new Map<string, string | undefined>();
    private server: IWebServer = new WebServer();
    constructor(
        @inject(KernelSelectionProvider) private readonly kernelSelectionProvider: KernelSelectionProvider,
        @inject(KernelSelector) private readonly kernelSelector: KernelSelector,
        @inject(IKernelProvider) private readonly kernelProvider: IKernelProvider,
        @inject(IVSCodeNotebook) private readonly notebook: IVSCodeNotebook,
        @inject(INotebookStorageProvider) private readonly storageProvider: INotebookStorageProvider,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(KernelSwitcher) private readonly kernelSwitcher: KernelSwitcher,
        @inject(INotebookContentProvider) private readonly notebookContentProvider: INotebookContentProvider,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(IPyWidgetMessageDispatcherFactory)
        private readonly widgetMessageDispatcherFactory: IPyWidgetMessageDispatcherFactory,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem,
        @inject(IConfigurationService) private readonly configurationSettings: IConfigurationService,
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
        return localResource;
        // return this.webview.asWebviewUri(localResource);
    }
    public async resolveKernel?(
        kernel: VSCodeNotebookKernelMetadata,
        document: NotebookDocument,
        webview: NotebookCommunication,
        _token: CancellationToken
    ): Promise<void> {
        this.webview = webview;
        // if (process.env['1234']) {
        const model = this.storageProvider.get(document.uri);
        this.jupyterNotebook = await this.notebookProvider.getOrCreateNotebook({
            resource: document.uri,
            identity: document.uri,
            metadata: model?.metadata,
            disableUI: false,
            getOnly: false
        });
        await this.server.start();
        const dispatcher = this.getIPyWidgetMessageDispatcher(document);
        // this.getIPyWidgetMessageDispatcher(document);
        // await dispatcher.initialize();
        dispatcher.postMessage((e) => {
            // webview.postMessage({ type: '__IPYWIDGET_KERNEL_MESSAGE', payload: e });
            this.postMessage(e);
        });
        // }
        // return Promise.race([
        //     kernel.hasBeenValidated.promise,
        //     createPromiseFromCancellation({ cancelAction: 'resolve', token, defaultValue: void 0 })
        // ]);
        // tslint:disable-next-line: no-console
        console.error('Kernel', kernel);
        this.postMessage({ type: 'fromKernel', payload: 'DataFromKernel' });
        this.server.onDidReceiveMessage((msg) => {
            const type: string = msg.type || msg.message;
            if (msg && type === IPyWidgetMessages.IPyWidgets_WidgetScriptSourceRequest) {
                this.sendWidgetSource(msg.payload.moduleName, msg.payload.moduleVersion).catch((ex) =>
                    // tslint:disable-next-line: no-console
                    console.error('Failed to get widget script source in kernelProvider.ts', ex)
                );
                return;
            } else if (msg && type && type.toUpperCase().startsWith('IPYWIDGET')) {
                // tslint:disable-next-line: no-any
                dispatcher.receiveMessage({ message: type, payload: msg.payload } as any);
            } else {
                // tslint:disable-next-line: no-console
                console.error(`Message from UI kernel`, msg);
            }
        });
        // webview.onDidReceiveMessage((msg) => {
        //     const type: string = msg.type || msg.message;
        //     if (msg && type === IPyWidgetMessages.IPyWidgets_WidgetScriptSourceRequest) {
        //         this.sendWidgetSource(msg.payload.moduleName, msg.payload.moduleVersion).catch((ex) =>
        //             // tslint:disable-next-line: no-console
        //             console.error('Failed to get widget script source in kernelProvider.ts', ex)
        //         );
        //         return;
        //     } else if (msg && type && type.toUpperCase().startsWith('IPYWIDGET')) {
        //         // tslint:disable-next-line: no-any
        //         dispatcher.receiveMessage({ message: type, payload: msg.payload } as any);
        //     } else {
        //         // tslint:disable-next-line: no-console
        //         console.error(`Message from UI kernel`, msg);
        //     }
        // });
        // Let UI kernel know we are ready.
        // webview.postMessage({ type: '__IPYWIDGET_BACKEND_READY' });
        // this.server.postMessage({ type: '__IPYWIDGET_BACKEND_READY' });
        this.postMessage({ type: '__IPYWIDGET_BACKEND_READY' });
    }

    public async provideKernels(
        document: NotebookDocument,
        token: CancellationToken
    ): Promise<VSCodeNotebookKernelMetadata[]> {
        const [preferredKernel, kernels, activeInterpreter] = await Promise.all([
            this.getPreferredKernel(document, token),
            this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'raw', undefined, token),
            this.interpreterService.getActiveInterpreter(document.uri)
        ]);
        if (token.isCancellationRequested) {
            return [];
        }

        // Default the interpreter to the local interpreter (if none is provided).
        return kernels.map((kernel) => {
            const selection = cloneDeep(kernel.selection); // Always clone, so we can make changes to this.
            selection.interpreter = selection.interpreter || activeInterpreter;
            return new VSCodeNotebookKernelMetadata(
                kernel.label,
                kernel.description || kernel.detail || '',
                selection,
                areKernelConnectionsEqual(selection, preferredKernel),
                this.kernelProvider
            );
        });
    }
    private async getPreferredKernel(document: NotebookDocument, token: CancellationToken) {
        // If we already have a kernel selected, then return that.
        const editor =
            this.notebook.notebookEditors.find((e) => e.document === document) ||
            (this.notebook.activeNotebookEditor?.document === document
                ? this.notebook.activeNotebookEditor
                : undefined);
        if (editor && editor.kernel && editor.kernel instanceof VSCodeNotebookKernelMetadata) {
            return editor.kernel.selection;
        }
        return this.kernelSelector.getPreferredKernelForLocalConnection(
            document.uri,
            'raw',
            undefined,
            getNotebookMetadata(document),
            true,
            token
        );
    }
    private async onDidChangeActiveNotebookKernel({
        document,
        kernel
    }: {
        document: NotebookDocument;
        kernel: VSCNotebookKernel | undefined;
    }) {
        // We're only interested in our Jupyter Notebooks & our kernels.
        if (!kernel || !(kernel instanceof VSCodeNotebookKernelMetadata) || !isJupyterNotebook(document)) {
            return;
        }
        const selectedKernelConnectionMetadata = kernel.selection;

        const model = this.storageProvider.get(document.uri);
        if (!model || !model.isTrusted) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: https://github.com/microsoft/vscode-python/issues/13476
            // If a model is not trusted, we cannot change the kernel (this results in changes to notebook metadata).
            // This is because we store selected kernel in the notebook metadata.
            return;
        }

        const existingKernel = this.kernelProvider.get(document.uri);
        if (existingKernel && areKernelConnectionsEqual(existingKernel.metadata, selectedKernelConnectionMetadata)) {
            return;
        }

        // Make this the new kernel (calling this method will associate the new kernel with this Uri).
        // Calling `getOrCreate` will ensure a kernel is created and it is mapped to the Uri provided.
        // This way other parts of extension have access to this kernel immediately after event is handled.
        this.kernelProvider.getOrCreate(document.uri, {
            metadata: selectedKernelConnectionMetadata
        });

        // Change kernel and update metadata.
        const notebook = await this.notebookProvider.getOrCreateNotebook({
            resource: document.uri,
            identity: document.uri,
            getOnly: true
        });

        // If we have a notebook, change its kernel now
        if (notebook) {
            if (!this.notebookKernelChangeHandled.has(notebook)) {
                this.notebookKernelChangeHandled.add(notebook);
                notebook.onKernelChanged(
                    (e) => {
                        if (notebook.disposed) {
                            return;
                        }
                        updateKernelInNotebookMetadata(document, e, this.notebookContentProvider);
                    },
                    this,
                    this.disposables
                );
            }
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: https://github.com/microsoft/vscode-python/issues/13514
            // We need to handle these exceptions in `siwthKernelWithRetry`.
            // We shouldn't handle them here, as we're already handling some errors in the `siwthKernelWithRetry` method.
            // Adding comment here, so we have context for the requirement.
            this.kernelSwitcher.switchKernelWithRetry(notebook, selectedKernelConnectionMetadata).catch(noop);
        } else {
            updateKernelInNotebookMetadata(document, selectedKernelConnectionMetadata, this.notebookContentProvider);
        }
    }
    private postMessage(message: any) {
        this.webview.postMessage(1);
        // this.webview.postMessage(message);
        this.server.postMessage(message);
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
            this.postMessage({
                type: IPyWidgetMessages.IPyWidgets_WidgetScriptSourceResponse,
                payload: widgetSource
            });
            // Send to UI (even if there's an error) continues instead of hanging while waiting for a response.
            this.postMessage({
                type: '______1234_____',
                payload: 1234
            });
            this.postMessage({
                type: '______1234_____',
                payload: 1234
            });
            this.postMessage({
                type: '______1234_____',
                payload: 1234
            });
            this.postMessage({
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
}
