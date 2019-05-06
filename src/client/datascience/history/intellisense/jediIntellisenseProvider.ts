// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import { inject, injectable } from 'inversify';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CancellationToken, CancellationTokenSource, Event, EventEmitter, Uri } from 'vscode';

import { IWorkspaceService } from '../../../common/application/types';
import { IFileSystem, TemporaryFile } from '../../../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IExtensionContext } from '../../../common/types';
import { IServiceManager } from '../../../ioc/types';
import { JediFactory } from '../../../languageServices/jediProxyFactory';
import { PythonCompletionItemProvider } from '../../../providers/completionProvider';
import { PythonHoverProvider } from '../../../providers/hoverProvider';
import { Identifiers } from '../../constants';
import { IHistoryListener } from '../../types';
import {
    HistoryMessages,
    IAddCell,
    ICancelIntellisenseRequest,
    IEditCell,
    IHistoryMapping,
    IProvideCompletionItemsRequest,
    IProvideHoverRequest
} from '.././historyTypes';
import { convertToMonacoCompletionList, convertToMonacoHover } from './conversion';
import { IntellisenseDocument } from './intellisenseDocument';

// tslint:disable:no-any
@injectable()
export class JediIntellisenseProvider implements IHistoryListener {

    private temporaryFile: TemporaryFile | undefined;
    private document: IntellisenseDocument | undefined;
    private postEmitter: EventEmitter<{message: string; payload: any}> = new EventEmitter<{message: string; payload: any}>();
    private cancellationSources : Map<string, CancellationTokenSource> = new Map<string, CancellationTokenSource>();
    private active: boolean = false;
    private pythonHoverProvider : PythonHoverProvider | undefined;
    private pythonCompletionItemProvider : PythonCompletionItemProvider | undefined;
    private jediFactory: JediFactory;
    private readonly context: IExtensionContext;

    constructor(
        @inject(IServiceManager) private serviceManager: IServiceManager,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {
        this.context = this.serviceManager.get<IExtensionContext>(IExtensionContext);
        this.jediFactory = new JediFactory(this.context.asAbsolutePath('.'), this.serviceManager);
        this.disposables.push(this.jediFactory);

        // Make sure we're active. We still listen to messages for adding and editing cells,
        // but we don't actually return any data.
        this.active = this.configService.getSettings().jediEnabled;

        // Listen for updates to settings to change this flag
        disposables.push(this.configService.getSettings().onDidChange(() => this.active = this.configService.getSettings().jediEnabled));

        // Create our jedi wrappers
        this.pythonHoverProvider = new PythonHoverProvider(this.jediFactory);
        this.pythonCompletionItemProvider = new PythonCompletionItemProvider(this.jediFactory, this.serviceManager);
    }

    public dispose() {
        this.jediFactory.dispose();
        if (this.temporaryFile) {
            this.temporaryFile.dispose();
        }
    }

    public get postMessage(): Event<{message: string; payload: any}> {
        return this.postEmitter.event;
    }

    public onMessage(message: string, payload?: any) {
        switch (message) {
            case HistoryMessages.CancelCompletionItemsRequest:
            case HistoryMessages.CancelHoverRequest:
                if (this.active) {
                    this.dispatchMessage(message, payload, this.handleCancel);
                }
                break;

            case HistoryMessages.ProvideCompletionItemsRequest:
                if (this.active) {
                    this.dispatchMessage(message, payload, this.handleCompletionItemsRequest);
                }
                break;

            case HistoryMessages.ProvideHoverRequest:
                if (this.active) {
                    this.dispatchMessage(message, payload, this.handleHoverRequest);
                }
                break;

            case HistoryMessages.EditCell:
                this.dispatchMessage(message, payload, this.editCell);
                break;

            case HistoryMessages.AddCell: // Might want to rethink this. Seems weird.
                this.dispatchMessage(message, payload, this.addCell);
                break;

            default:
                break;
        }
    }

    private dispatchMessage<M extends IHistoryMapping, T extends keyof M>(_message: T, payload: any, handler: (args : M[T]) => void) {
        const args = payload as M[T];
        handler.bind(this)(args);
    }

    private postResponse<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) : void {
        const response = payload as any;
        if (response && response.id) {
            const cancelSource = this.cancellationSources.get(response.id);
            if (cancelSource) {
                cancelSource.dispose();
                this.cancellationSources.delete(response.id);
            }
        }
        this.postEmitter.fire({message: type.toString(), payload});
    }

    private handleCancel(request: ICancelIntellisenseRequest) {
        const cancelSource = this.cancellationSources.get(request.requestId);
        if (cancelSource) {
            cancelSource.cancel();
            cancelSource.dispose();
            this.cancellationSources.delete(request.requestId);
        }
    }

    private handleCompletionItemsRequest(request: IProvideCompletionItemsRequest) {
        const cancelSource = new CancellationTokenSource();
        this.cancellationSources.set(request.requestId, cancelSource);
        this.provideCompletionItems(request.position, request.context, request.cellId, cancelSource.token).then(list => {
             this.postResponse(HistoryMessages.ProvideCompletionItemsResponse, {list, requestId: request.requestId});
        }).catch(_e => {
            this.postResponse(HistoryMessages.ProvideCompletionItemsResponse, {list: { suggestions: [], incomplete: true }, requestId: request.requestId});
        });
    }

    private handleHoverRequest(request: IProvideHoverRequest) {
        const cancelSource = new CancellationTokenSource();
        this.cancellationSources.set(request.requestId, cancelSource);
        this.provideHover(request.position, request.cellId, cancelSource.token).then(hover => {
             this.postResponse(HistoryMessages.ProvideHoverResponse, {hover, requestId: request.requestId});
        }).catch(_e => {
            this.postResponse(HistoryMessages.ProvideHoverResponse, {hover: { contents: [] }, requestId: request.requestId});
        });
    }

    private async createDocument(resource?: Uri) : Promise<IntellisenseDocument> {
        if (!this.document) {
            // Create our dummy document. Compute a file path for it.
            let dummyFilePath = '';
            if (this.workspaceService.rootPath || resource) {
                const dir = resource ? path.dirname(resource.fsPath) : this.workspaceService.rootPath!;
                dummyFilePath = path.join(dir, `History_${uuid().replace(/-/g, '')}.py`);
            } else {
                this.temporaryFile = await this.fileSystem.createTemporaryFile('.py');
                dummyFilePath = this.temporaryFile.filePath;
            }
            this.document = new IntellisenseDocument(dummyFilePath);
        }
        return this.document;
    }

    private async provideCompletionItems(position: monacoEditor.Position, _context: monacoEditor.languages.CompletionContext, cellId: string, token: CancellationToken) : Promise<monacoEditor.languages.CompletionList> {
        if (this.pythonCompletionItemProvider && this.document) {
            const docPos = this.document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await this.pythonCompletionItemProvider.provideCompletionItems(this.document, docPos, token);
            return convertToMonacoCompletionList(result);
        }

        return {
            suggestions: [],
            incomplete: true
        };
    }
    private async provideHover(position: monacoEditor.Position, cellId: string, token: CancellationToken) : Promise<monacoEditor.languages.Hover> {
        if (this.pythonHoverProvider && this.document) {
            const docPos = this.document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await this.pythonHoverProvider.provideHover(this.document, docPos, token);
            return convertToMonacoHover(result);
        }

        return {
            contents: []
        };
    }
    private async addCell(request: IAddCell): Promise<void> {
        const document = await this.createDocument(request.file === Identifiers.EmptyFileName ? undefined : Uri.file(request.file));

        if (document) {
            document.addCell(request.text, request.id);
        }

        // The dot net completion provider needs to broadcast an update. For jedi we just use our dummy document
    }
    private async editCell(request: IEditCell): Promise<void> {
        const document = await this.createDocument();
        if (document) {
            document.edit(request.changes, request.id);
        }

        // The dot net completion provider needs to broadcast an update. For jedi we just use our dummy document
    }

}
