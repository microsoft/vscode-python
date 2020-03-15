// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-any

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { EventEmitter, Uri, WebviewPanel } from 'vscode';
import { ICustomEditorService, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { AsyncDisposableRegistry } from '../../../client/common/asyncDisposableRegistry';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { IConfigurationService } from '../../../client/common/types';
import { noop } from '../../../client/common/utils/misc';
import { NativeEditorProvider } from '../../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { INotebookEditor, INotebookModel, INotebookStorage } from '../../../client/datascience/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable: max-func-body-length
suite('Data Science - Native Editor Provider', () => {
    let workspace: IWorkspaceService;
    let configService: IConfigurationService;
    let svcContainer: IServiceContainer;
    let editor: typemoq.IMock<INotebookEditor>;
    let storage: typemoq.IMock<INotebookStorage & INotebookModel>;
    let customEditorService: typemoq.IMock<ICustomEditorService>;
    let file: Uri;
    let storageFile: Uri;
    let registeredProvider: NativeEditorProvider;
    let panel: typemoq.IMock<WebviewPanel>;

    setup(() => {
        svcContainer = mock(ServiceContainer);
        configService = mock(ConfigurationService);
        workspace = mock(WorkspaceService);
        storage = typemoq.Mock.ofType<INotebookStorage & INotebookModel>();
        customEditorService = typemoq.Mock.ofType<ICustomEditorService>();
        panel = typemoq.Mock.ofType<WebviewPanel>();
        panel.setup(e => (e as any).then).returns(() => undefined);
    });

    function createNotebookProvider() {
        editor = typemoq.Mock.ofType<INotebookEditor>();
        when(configService.getSettings(anything())).thenReturn({ datascience: { useNotebookEditor: true } } as any);
        editor.setup(e => e.closed).returns(() => new EventEmitter<INotebookEditor>().event);
        editor.setup(e => e.executed).returns(() => new EventEmitter<INotebookEditor>().event);
        editor.setup(e => (e as any).then).returns(() => undefined);
        storage.setup(e => (e as any).then).returns(() => undefined);
        storage
            .setup(s => s.load(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(f => {
                storageFile = f;
                return Promise.resolve(storage.object);
            });
        storage.setup(s => s.file).returns(() => storageFile);
        when(svcContainer.get<INotebookEditor>(INotebookEditor)).thenReturn(editor.object);
        when(svcContainer.get<INotebookStorage>(INotebookStorage)).thenReturn(storage.object);
        customEditorService.setup(e => (e as any).then).returns(() => undefined);
        customEditorService
            .setup(c =>
                c.registerWebviewCustomEditorProvider(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny())
            )
            .returns((_a1, _a2, _a3) => {
                return { dispose: noop };
            });
        customEditorService
            .setup(c => c.openEditor(typemoq.It.isAny()))
            .returns(async f => {
                return registeredProvider.resolveWebviewEditor(f, panel.object);
            });

        editor
            .setup(e => e.load(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns((s, _p) => {
                file = s.file;
                return Promise.resolve();
            });
        editor.setup(e => e.show()).returns(() => Promise.resolve());
        editor.setup(e => e.file).returns(() => file);

        registeredProvider = new NativeEditorProvider(
            instance(svcContainer),
            instance(mock(AsyncDisposableRegistry)),
            [],
            instance(workspace),
            instance(configService),
            customEditorService.object
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
});
