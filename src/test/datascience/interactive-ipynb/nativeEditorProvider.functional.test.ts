// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-any

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import { Matcher } from 'ts-mockito/lib/matcher/type/Matcher';
import * as typemoq from 'typemoq';
import { ConfigurationChangeEvent, EventEmitter, FileType, TextEditor, Uri, WebviewPanel } from 'vscode';
import { CancellationToken } from 'vscode-languageclient/node';
import { DocumentManager } from '../../../client/common/application/documentManager';
import {
    CustomDocument,
    ICustomEditorService,
    IDocumentManager,
    IWebPanelMessageListener,
    IWebPanelProvider,
    IWorkspaceService
} from '../../../client/common/application/types';
import { WebPanel } from '../../../client/common/application/webPanels/webPanel';
import { WebPanelProvider } from '../../../client/common/application/webPanels/webPanelProvider';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { AsyncDisposableRegistry } from '../../../client/common/asyncDisposableRegistry';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { CryptoUtils } from '../../../client/common/crypto';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, ICryptoUtils, IExtensionContext } from '../../../client/common/types';
import { noop } from '../../../client/common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { NativeEditorProvider } from '../../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { NativeEditorStorage } from '../../../client/datascience/interactive-ipynb/nativeEditorStorage';
import {
    INotebookStorageProvider,
    NotebookStorageProvider
} from '../../../client/datascience/interactive-ipynb/notebookStorageProvider';
import { JupyterExecutionFactory } from '../../../client/datascience/jupyter/jupyterExecutionFactory';
import {
    IJupyterExecution,
    INotebookEditor,
    INotebookModel,
    INotebookServerOptions,
    ITrustService
} from '../../../client/datascience/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { concatMultilineStringInput } from '../../../datascience-ui/common';
import { createEmptyCell } from '../../../datascience-ui/interactive-common/mainState';
import { MockMemento } from '../../mocks/mementos';
import { MockWorkspaceConfiguration } from '../mockWorkspaceConfig';

// tslint:disable: max-func-body-length
suite('DataScience - Native Editor Provider', () => {
    let workspace: IWorkspaceService;
    let configService: IConfigurationService;
    let fileSystem: typemoq.IMock<IFileSystem>;
    let docManager: IDocumentManager;
    let interpreterService: IInterpreterService;
    let webPanelProvider: IWebPanelProvider;
    let executionProvider: IJupyterExecution;
    let globalMemento: MockMemento;
    let localMemento: MockMemento;
    let trustService: ITrustService;
    let context: typemoq.IMock<IExtensionContext>;
    let crypto: ICryptoUtils;
    let lastWriteFileValue: any;
    let wroteToFileEvent: EventEmitter<string> = new EventEmitter<string>();
    let filesConfig: MockWorkspaceConfiguration | undefined;
    let testIndex = 0;
    let svcContainer: IServiceContainer;
    let customEditorService: typemoq.IMock<ICustomEditorService>;
    let registeredProvider: NativeEditorProvider;
    let panel: typemoq.IMock<WebviewPanel>;
    let file: Uri;
    let model: INotebookModel;
    let storageProvider: INotebookStorageProvider;

    setup(() => {
        svcContainer = mock(ServiceContainer);
        context = typemoq.Mock.ofType<IExtensionContext>();
        crypto = mock(CryptoUtils);
        globalMemento = new MockMemento();
        localMemento = new MockMemento();
        configService = mock(ConfigurationService);
        fileSystem = typemoq.Mock.ofType<IFileSystem>();
        docManager = mock(DocumentManager);
        workspace = mock(WorkspaceService);
        interpreterService = mock(InterpreterService);
        webPanelProvider = mock(WebPanelProvider);
        executionProvider = mock(JupyterExecutionFactory);
        customEditorService = typemoq.Mock.ofType<ICustomEditorService>();
        panel = typemoq.Mock.ofType<WebviewPanel>();
        trustService = mock(ITrustService);
        panel.setup((e) => (e as any).then).returns(() => undefined);

        const settings = mock(PythonSettings);
        const settingsChangedEvent = new EventEmitter<void>();

        context
            .setup((c) => c.globalStoragePath)
            .returns(() => path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience', 'WorkspaceDir'));

        when(settings.onDidChange).thenReturn(settingsChangedEvent.event);
        when(configService.getSettings()).thenReturn(instance(settings));

        const configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
        when(workspace.onDidChangeConfiguration).thenReturn(configChangeEvent.event);
        filesConfig = new MockWorkspaceConfiguration();
        when(workspace.getConfiguration('files', anything())).thenReturn(filesConfig);

        const interprerterChangeEvent = new EventEmitter<void>();
        when(interpreterService.onDidChangeInterpreter).thenReturn(interprerterChangeEvent.event);

        const editorChangeEvent = new EventEmitter<TextEditor | undefined>();
        when(docManager.onDidChangeActiveTextEditor).thenReturn(editorChangeEvent.event);

        const serverStartedEvent = new EventEmitter<INotebookServerOptions>();
        when(executionProvider.serverStarted).thenReturn(serverStartedEvent.event);

        testIndex += 1;
        when(crypto.createHash(anything(), 'string')).thenReturn(`${testIndex}`);

        let listener: IWebPanelMessageListener;
        const webPanel = mock(WebPanel);
        const startTime = Date.now();
        class WebPanelCreateMatcher extends Matcher {
            public match(value: any) {
                listener = value.listener;
                listener.onMessage(InteractiveWindowMessages.Started, undefined);
                return true;
            }
            public toString() {
                return '';
            }
        }
        const matcher = (): any => {
            return new WebPanelCreateMatcher();
        };
        when(webPanelProvider.create(matcher())).thenResolve(instance(webPanel));
        lastWriteFileValue = undefined;
        wroteToFileEvent = new EventEmitter<string>();
        fileSystem
            .setup((f) => f.writeFile(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns((a1, a2) => {
                if (a1.includes(`${testIndex}.ipynb`)) {
                    lastWriteFileValue = a2;
                    wroteToFileEvent.fire(a2);
                }
                return Promise.resolve();
            });
        fileSystem
            .setup((f) => f.readFile(typemoq.It.isAny()))
            .returns((_a1) => {
                return Promise.resolve(lastWriteFileValue);
            });
        fileSystem
            .setup((f) => f.stat(typemoq.It.isAny()))
            .returns((_a1) => {
                return Promise.resolve({ mtime: startTime, type: FileType.File, ctime: startTime, size: 100 });
            });
        const editor = typemoq.Mock.ofType<INotebookEditor>();
        when(configService.getSettings(anything())).thenReturn({ datascience: { useNotebookEditor: true } } as any);
        editor.setup((e) => e.closed).returns(() => new EventEmitter<INotebookEditor>().event);
        editor.setup((e) => e.executed).returns(() => new EventEmitter<INotebookEditor>().event);
        editor.setup((e) => (e as any).then).returns(() => undefined);
        customEditorService.setup((e) => (e as any).then).returns(() => undefined);
        customEditorService
            .setup((c) => c.registerCustomEditorProvider(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .returns((_a1, _a2, _a3) => {
                return { dispose: noop };
            });

        customEditorService
            .setup((c) => c.openEditor(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(async (f) => {
                const doc = typemoq.Mock.ofType<CustomDocument>();
                doc.setup((d) => d.uri).returns(() => f);
                return registeredProvider.resolveCustomEditor(doc.object, panel.object);
            });

        editor
            .setup((e) => e.load(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns((s, _p) => {
                file = s.file;
                model = s;
                return Promise.resolve();
            });
        editor.setup((e) => e.show()).returns(() => Promise.resolve());
        editor.setup((e) => e.file).returns(() => file);

        when(svcContainer.get<INotebookEditor>(INotebookEditor)).thenReturn(editor.object);
    });

    function createNotebookProvider() {
        const notebookStorage = new NativeEditorStorage(
            instance(executionProvider),
            fileSystem.object, // Use typemoq so can save values in returns
            instance(crypto),
            context.object,
            globalMemento,
            localMemento,
            trustService,
            false
        );

        storageProvider = new NotebookStorageProvider(notebookStorage, []);

        registeredProvider = new NativeEditorProvider(
            instance(svcContainer),
            instance(mock(AsyncDisposableRegistry)),
            [],
            instance(workspace),
            instance(configService),
            customEditorService.object,
            storageProvider
        );

        return registeredProvider;
    }

    test('Opening a notebook', async () => {
        const provider = createNotebookProvider();
        const n = await provider.open(Uri.file('foo.ipynb'));
        expect(n.file.fsPath).to.be.include('foo.ipynb');
    });

    test('Multiple new notebooks have new names', async () => {
        const provider = createNotebookProvider();
        const n1 = await provider.createNew();
        expect(n1.file.fsPath).to.be.include('Untitled-1');
        const n2 = await provider.createNew();
        expect(n2.file.fsPath).to.be.include('Untitled-2');
    });

    test('Untitled files changing', async () => {
        const provider = createNotebookProvider();
        const n1 = await provider.createNew();
        expect(n1.file.fsPath).to.be.include('Untitled-1');
        await n1.dispose();
        const n2 = await provider.createNew();
        expect(n2.file.fsPath).to.be.include('Untitled-2');
        await n2.dispose();
        const n3 = await provider.createNew();
        expect(n3.file.fsPath).to.be.include('Untitled-3');
    });

    function insertCell(nbm: INotebookModel, index: number, code: string) {
        const cell = createEmptyCell(undefined, 1);
        cell.data.source = code;
        return nbm.update({
            source: 'user',
            kind: 'insert',
            oldDirty: nbm.isDirty,
            newDirty: true,
            cell,
            index
        });
    }

    test('Untitled files reopening with changed contents', async () => {
        let provider = createNotebookProvider();
        const n1 = await provider.createNew();
        let cells = model!.cells;
        expect(cells).to.be.lengthOf(1);
        insertCell(model!, 0, 'a=1');
        await storageProvider.backup(model, CancellationToken.None);
        const uri = n1.file;

        // Act like a reboot
        provider = createNotebookProvider();
        await provider.open(uri);
        cells = model!.cells;
        expect(cells).to.be.lengthOf(2);
        expect(concatMultilineStringInput(cells[0].data.source)).to.be.eq('a=1');

        // Act like another reboot but create a new file
        provider = createNotebookProvider();
        await provider.createNew();
        cells = model!.cells;
        expect(cells).to.be.lengthOf(1);
    });
});
