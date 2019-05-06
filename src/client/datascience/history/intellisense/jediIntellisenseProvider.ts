// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import { inject, injectable } from 'inversify';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { CancellationToken, TextDocumentContentChangeEvent } from 'vscode';

import { IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IExtensionContext } from '../../../common/types';
import { IServiceManager } from '../../../ioc/types';
import { JediFactory } from '../../../languageServices/jediProxyFactory';
import { PythonCompletionItemProvider } from '../../../providers/completionProvider';
import { PythonHoverProvider } from '../../../providers/hoverProvider';
import { IHistoryListener } from '../../types';
import { BaseIntellisenseProvider } from './baseIntellisenseProvider';
import { convertToMonacoCompletionList, convertToMonacoHover } from './conversion';
import { IntellisenseDocument } from './intellisenseDocument';

// tslint:disable:no-any
@injectable()
export class JediIntellisenseProvider extends BaseIntellisenseProvider implements IHistoryListener {

    private active: boolean = false;
    private pythonHoverProvider : PythonHoverProvider | undefined;
    private pythonCompletionItemProvider : PythonCompletionItemProvider | undefined;
    private jediFactory: JediFactory;
    private readonly context: IExtensionContext;

    constructor(
        @inject(IServiceManager) private serviceManager: IServiceManager,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IFileSystem) fileSystem: IFileSystem
    ) {
        super(workspaceService, fileSystem);

        this.context = this.serviceManager.get<IExtensionContext>(IExtensionContext);
        this.jediFactory = new JediFactory(this.context.asAbsolutePath('.'), this.serviceManager);
        this.disposables.push(this.jediFactory);

        // Make sure we're active. We still listen to messages for adding and editing cells,
        // but we don't actually return any data.
        this.active = this.configService.getSettings().jediEnabled;

        // Listen for updates to settings to change this flag
        disposables.push(this.configService.getSettings().onDidChange(() => this.active = this.configService.getSettings().jediEnabled));

        // Create our jedi wrappers if necessary
        if (this.active) {
            this.pythonHoverProvider = new PythonHoverProvider(this.jediFactory);
            this.pythonCompletionItemProvider = new PythonCompletionItemProvider(this.jediFactory, this.serviceManager);
        }
    }

    public dispose() {
        super.dispose();
        this.jediFactory.dispose();
    }
    protected get isActive() : boolean {
        return this.active;
    }
    protected async provideCompletionItems(position: monacoEditor.Position, _context: monacoEditor.languages.CompletionContext, cellId: string, token: CancellationToken) : Promise<monacoEditor.languages.CompletionList> {
        const document = await this.getDocument();
        if (this.pythonCompletionItemProvider && document) {
            const docPos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await this.pythonCompletionItemProvider.provideCompletionItems(document, docPos, token);
            return convertToMonacoCompletionList(result, false);
        }

        return {
            suggestions: [],
            incomplete: true
        };
    }
    protected async provideHover(position: monacoEditor.Position, cellId: string, token: CancellationToken) : Promise<monacoEditor.languages.Hover> {
        const document = await this.getDocument();
        if (this.pythonHoverProvider && document) {
            const docPos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await this.pythonHoverProvider.provideHover(document, docPos, token);
            return convertToMonacoHover(result);
        }

        return {
            contents: []
        };
    }

    protected handleChanges(_originalFile: string | undefined, _document: IntellisenseDocument, _changes: TextDocumentContentChangeEvent[]) : Promise<void> {
        // We don't need to forward these to jedi. It always uses the entire document
        return Promise.resolve();
    }

}
