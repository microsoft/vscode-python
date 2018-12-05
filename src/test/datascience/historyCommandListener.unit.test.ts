// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import { assert } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { Matcher } from 'ts-mockito/lib/matcher/type/Matcher';
import * as TypeMoq from 'typemoq';
import {
    Disposable,
    Event,
    EventEmitter,
    TextDocument,
    TextDocumentShowOptions,
    TextEditor,
    TextEditorOptionsChangeEvent,
    TextEditorSelectionChangeEvent,
    TextEditorViewColumnChangeEvent,
    Uri,
    ViewColumn,
    WorkspaceEdit
} from 'vscode';

import { ApplicationShell } from '../../client/common/application/applicationShell';
import { IDocumentManager } from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { ConfigurationService } from '../../client/common/configuration/service';
import { Logger } from '../../client/common/logger';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IFileSystem } from '../../client/common/platform/types';
import { IConfigurationService, ILogger } from '../../client/common/types';
import { generateCells } from '../../client/datascience/cellFactory';
import { Commands } from '../../client/datascience/constants';
import { HistoryCommandListener } from '../../client/datascience/historycommandlistener';
import { HistoryProvider } from '../../client/datascience/historyProvider';
import { JupyterExecution } from '../../client/datascience/jupyterExecution';
import { JupyterExporter } from '../../client/datascience/jupyterExporter';
import { JupyterImporter } from '../../client/datascience/jupyterImporter';
import { IHistory, INotebookServer, IStatusProvider } from '../../client/datascience/types';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { KnownSearchPathsForInterpreters } from '../../client/interpreter/locators/services/KnownPathsService';
import { ServiceContainer } from '../../client/ioc/container';
import { noop } from '../core';
import * as vscodeMocks from '../vscode-mock';
import { createDocument } from './editor-integration/helpers';
import { MockCommandManager } from './mockCommandManager';

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length

function createTypeMoq<T>(tag: string) : TypeMoq.IMock<T> {
    // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
    // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
    const result = TypeMoq.Mock.ofType<T>();
    result['tag'] = tag;
    result.setup((x: any) => x.then).returns(() => undefined);
    return result;
}

class MockDocumentManager implements IDocumentManager {
    public textDocuments: TextDocument[] = [];
    public activeTextEditor: TextEditor | undefined;
    public visibleTextEditors: TextEditor[] = [];
    private didChangeEmitter = new EventEmitter<TextEditor>();
    private didOpenEmitter = new EventEmitter<TextDocument>();
    private didChangeVisibleEmitter = new EventEmitter<TextEditor[]>();
    private didChangeTextEditorSelectionEmitter = new EventEmitter<TextEditorSelectionChangeEvent>();
    private didChangeTextEditorOptionsEmitter = new EventEmitter<TextEditorOptionsChangeEvent>();
    private didChangeTextEditorViewColumnEmitter = new EventEmitter<TextEditorViewColumnChangeEvent>();
    private didCloseEmitter = new EventEmitter<TextDocument>();
    private didSaveEmitter = new EventEmitter<TextDocument>();
    public get onDidChangeActiveTextEditor() : Event<TextEditor> {
        return this.didChangeEmitter.event;
    }
    public get onDidOpenTextDocument() : Event<TextDocument> {
        return this.didOpenEmitter.event;
    }
    public get onDidChangeVisibleTextEditors() : Event<TextEditor[]> {
        return this.didChangeVisibleEmitter.event;
    }
    public get onDidChangeTextEditorSelection() : Event<TextEditorSelectionChangeEvent> {
        return this.didChangeTextEditorSelectionEmitter.event;
    }
    public get onDidChangeTextEditorOptions() : Event<TextEditorOptionsChangeEvent> {
        return this.didChangeTextEditorOptionsEmitter.event;
    }
    public get onDidChangeTextEditorViewColumn() : Event<TextEditorViewColumnChangeEvent> {
        return this.didChangeTextEditorViewColumnEmitter.event;
    }
    public get onDidCloseTextDocument() : Event<TextDocument> {
        return this.didCloseEmitter.event;
    }
    public get onDidSaveTextDocument() : Event<TextDocument> {
        return this.didSaveEmitter.event;
    }
    public showTextDocument(document: TextDocument, column?: ViewColumn, preserveFocus?: boolean): Thenable<TextEditor>;
    public showTextDocument(document: TextDocument | Uri, options?: TextDocumentShowOptions): Thenable<TextEditor>;
    public showTextDocument(document: any, column?: any, preserveFocus?: any): Thenable<TextEditor> {
        const mockEditor = createTypeMoq<TextEditor>('TextEditor');
        mockEditor.setup(e => e.document).returns(() => this.getDocument());
        this.activeTextEditor = mockEditor.object;
        return Promise.resolve(mockEditor.object);
    }
    public openTextDocument(fileName: string | Uri): Thenable<TextDocument>;
    public openTextDocument(options?: { language?: string; content?: string }): Thenable<TextDocument>;
    public openTextDocument(options?: any): Thenable<TextDocument> {
        return Promise.resolve(this.getDocument());
    }
    public applyEdit(edit: WorkspaceEdit): Thenable<boolean> {
        throw new Error('Method not implemented.');
    }

    private getDocument() : TextDocument {
        const mockDoc = createDocument('#%%\r\nprint("code")', 'bar.ipynb', 1, TypeMoq.Times.atMost(100), true);
        mockDoc.setup((x: any) => x.then).returns(() => undefined);
        return mockDoc.object;
    }
}

class MockStatusProvider implements IStatusProvider {
    public set(message: string, history?: IHistory, timeout?: number): Disposable {
        return {
            dispose: noop
        };
    }

    public waitWithStatus<T>(promise: () => Promise<T>, message: string, history?: IHistory, timeout?: number, canceled?: () => void): Promise<T> {
        return promise();
    }

}

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length
suite('History command listener', async () => {
    const interpreterService = mock(InterpreterService);
    const configService = mock(ConfigurationService);
    const knownSearchPaths = mock(KnownSearchPathsForInterpreters);
    const logger = mock(Logger);
    const fileSystem = mock(FileSystem);
    const serviceContainer = mock(ServiceContainer);
    const dummyEvent = new EventEmitter<void>();
    const pythonSettings = new PythonSettings();
    const disposableRegistry = [];
    const historyProvider = mock(HistoryProvider);
    const notebookImporter = mock(JupyterImporter);
    const notebookExporter = mock(JupyterExporter);
    const applicationShell = mock(ApplicationShell);
    const jupyterExecution = mock(JupyterExecution);
    const documentManager = new MockDocumentManager();
    const statusProvider = new MockStatusProvider();
    const commandManager = new MockCommandManager();
    const server = createTypeMoq<INotebookServer>('jupyter server');
    let lastFileContents: any;

    suiteSetup(() => {
        vscodeMocks.initialize();
    });
    suiteTeardown(() => {
        noop();
    });

    setup(() => {
        noop();
    });

    teardown(() => {
        documentManager.activeTextEditor = undefined;
        lastFileContents = undefined;
    });

    class FunctionMatcher extends Matcher {
        private func: (obj: any) => boolean;
        constructor(func: (obj: any) => boolean) {
            super();
            this.func = func;
        }
        public match(value: Object): boolean {
            return this.func(value);
        }
        public toString(): string
        {
            return 'FunctionMatcher';
        }
    }

    function argThat(func: (obj: any) => boolean) : any {
        return new FunctionMatcher(func);
    }

    function createCommandListener(activeHistory: IHistory | undefined) : HistoryCommandListener {
        // Setup defaults
        when(interpreterService.onDidChangeInterpreter).thenReturn(dummyEvent.event);
        when(interpreterService.getInterpreterDetails(argThat(o => !o.includes || !o.includes('python')))).thenReject('Unknown interpreter');

        // Service container needs logger, file system, and config service
        when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(instance(configService));
        when(serviceContainer.get<IFileSystem>(IFileSystem)).thenReturn(instance(fileSystem));
        when(serviceContainer.get<ILogger>(ILogger)).thenReturn(instance(logger));
        when(configService.getSettings()).thenReturn(pythonSettings);

        // Setup default settings
        pythonSettings.datascience = {
            allowImportFromNotebook: true,
            jupyterLaunchTimeout: 10,
            enabled: true,
            jupyterServerURI: '',
            useDefaultConfigForJupyter: true
        };

        when(knownSearchPaths.getSearchPaths()).thenReturn(['/foo/bar']);

        // We also need a file system
        const tempFile = {
            dispose: () => {
                return undefined;
            },
            filePath: '/foo/bar/baz.py'
        };
        when(fileSystem.createTemporaryFile(anything())).thenResolve(tempFile);
        when(fileSystem.deleteDirectory(anything())).thenResolve();
        when(fileSystem.writeFile(anything(), argThat(o => { lastFileContents = o; return true; }))).thenResolve();
        when(fileSystem.arePathsSame(anything(), anything())).thenReturn(true);

        when(historyProvider.getActive()).thenReturn(activeHistory);
        when(notebookImporter.importFromFile(anything())).thenResolve('imported');
        const metadata: nbformat.INotebookMetadata = {
            language_info: {
                name: 'python',
                codemirror_mode: {
                    name: 'ipython',
                    version: 3
                }
            },
            orig_nbformat: 2,
            file_extension: '.py',
            mimetype: 'text/x-python',
            name: 'python',
            npconvert_exporter: 'python',
            pygments_lexer: `ipython${3}`,
            version: 3
        };
        when(notebookExporter.translateToNotebook(anything())).thenResolve(
            {
                cells: [],
                nbformat: 4,
                nbformat_minor: 2,
                metadata: metadata
            }
        );
        when(jupyterExecution.isNotebookSupported()).thenResolve(true);

        const result = new HistoryCommandListener(
            disposableRegistry,
            instance(historyProvider),
            instance(notebookImporter),
            instance(notebookExporter),
            instance(jupyterExecution),
            documentManager,
            instance(applicationShell),
            instance(fileSystem),
            instance(logger),
            instance(configService),
            statusProvider);

        result.register(commandManager);

        return result;
    }

    test('Import', async () => {
        createCommandListener(undefined);
        when(applicationShell.showOpenDialog(argThat(o => o.openLabel && o.openLabel.includes('Import')))).thenReturn(Promise.resolve([Uri.file('foo')]));
        await commandManager.executeCommand(Commands.ImportNotebook);
        assert.ok(documentManager.activeTextEditor, 'Imported file was not opened');
    });
    test('Import File', async () => {
        createCommandListener(undefined);
        await commandManager.executeCommand(Commands.ImportNotebook, Uri.file('bar.ipynb'));
        assert.ok(documentManager.activeTextEditor, 'Imported file was not opened');
    });
    test('Export File', async () => {
        createCommandListener(undefined);
        const doc = await documentManager.openTextDocument('bar.ipynb');
        await documentManager.showTextDocument(doc);
        when(applicationShell.showSaveDialog(argThat(o => o.saveLabel && o.saveLabel.includes('Export')))).thenReturn(Promise.resolve(Uri.file('foo')));

        await commandManager.executeCommand(Commands.ExportFileAsNotebook, Uri.file('bar.ipynb'));
        assert.ok(lastFileContents, 'Export file was not written to');
    });
    test('Export File and output', async () => {
        createCommandListener(undefined);
        const doc = await documentManager.openTextDocument('bar.ipynb');
        await documentManager.showTextDocument(doc);
        when(jupyterExecution.connectToNotebookServer(anything(), anything())).thenResolve(server.object);
        server.setup(s => s.execute(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAnyNumber(), TypeMoq.It.isAny())).returns(() => {
            return Promise.resolve(generateCells('a=1', 'bar.py', 0, false));
        });

        when(applicationShell.showSaveDialog(argThat(o => o.saveLabel && o.saveLabel.includes('Export')))).thenReturn(Promise.resolve(Uri.file('foo')));
        when(applicationShell.showInformationMessage(anything(), anything())).thenReturn(Promise.resolve('moo'));

        await commandManager.executeCommand(Commands.ExportFileAndOutputAsNotebook, Uri.file('bar.ipynb'));
        assert.ok(lastFileContents, 'Export file was not written to');
    });
    test('Export skipped on no file', async () => {
        createCommandListener(undefined);
        when(applicationShell.showSaveDialog(argThat(o => o.saveLabel && o.saveLabel.includes('Export')))).thenReturn(Promise.resolve(Uri.file('foo')));
        await commandManager.executeCommand(Commands.ExportFileAndOutputAsNotebook, Uri.file('bar.ipynb'));
        assert.notExists(lastFileContents, 'Export file was written to');
    });
    test('Export happens on no file', async () => {
        createCommandListener(undefined);
        const doc = await documentManager.openTextDocument('bar.ipynb');
        await documentManager.showTextDocument(doc);
        when(applicationShell.showSaveDialog(argThat(o => o.saveLabel && o.saveLabel.includes('Export')))).thenReturn(Promise.resolve(Uri.file('foo')));
        await commandManager.executeCommand(Commands.ExportFileAsNotebook);
        assert.ok(lastFileContents, 'Export file was not written to');
    });

});
