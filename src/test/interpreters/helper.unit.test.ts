// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, TextDocument, TextEditor, Uri } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { IServiceContainer } from '../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Interpreters Display Helper', () => {
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let helper: InterpreterHelper;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDocumentManager))).returns(() => documentManager.object);

        helper = new InterpreterHelper(serviceContainer.object);
    });
    test('getActiveWorkspaceUri should return undefined if there are no workspaces', () => {
        workspaceService.setup(w => w.workspaceFolders).returns(() => []);
        documentManager.setup(doc => doc.activeTextEditor).returns(() => undefined);
        const workspace = helper.getActiveWorkspaceUri();
        expect(workspace).to.be.equal(undefined, 'incorrect value');
    });
    test('getActiveWorkspaceUri should return the workspace if there is only one', () => {
        const folderUri = Uri.file('abc');
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.workspaceFolders).returns(() => [{ uri: folderUri } as any]);

        const workspace = helper.getActiveWorkspaceUri();
        expect(workspace).to.be.not.equal(undefined, 'incorrect value');
        expect(workspace!.folderUri).to.be.equal(folderUri);
        expect(workspace!.configTarget).to.be.equal(ConfigurationTarget.Workspace);
    });
    test('getActiveWorkspaceUri should return undefined if we no active editor and have more than one workspace folder', () => {
        const folderUri = Uri.file('abc');
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.workspaceFolders).returns(() => [{ uri: folderUri } as any, undefined as any]);
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);

        const workspace = helper.getActiveWorkspaceUri();
        expect(workspace).to.be.equal(undefined, 'incorrect value');
    });
    test('getActiveWorkspaceUri should return undefined of the active editor does not belong to a workspace and if we have more than one workspace folder', () => {
        const folderUri = Uri.file('abc');
        const documentUri = Uri.file('file');
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.workspaceFolders).returns(() => [{ uri: folderUri } as any, undefined as any]);
        const textEditor = TypeMoq.Mock.ofType<TextEditor>();
        const document = TypeMoq.Mock.ofType<TextDocument>();
        textEditor.setup(t => t.document).returns(() => document.object);
        document.setup(d => d.uri).returns(() => documentUri);
        documentManager.setup(d => d.activeTextEditor).returns(() => textEditor.object);
        workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(documentUri))).returns(() => undefined);

        const workspace = helper.getActiveWorkspaceUri();
        expect(workspace).to.be.equal(undefined, 'incorrect value');
    });
    test('getActiveWorkspaceUri should return workspace folder of the active editor if belongs to a workspace and if we have more than one workspace folder', () => {
        const folderUri = Uri.file('abc');
        const documentWorkspaceFolderUri = Uri.file('file.abc');
        const documentUri = Uri.file('file');
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.workspaceFolders).returns(() => [{ uri: folderUri } as any, undefined as any]);
        const textEditor = TypeMoq.Mock.ofType<TextEditor>();
        const document = TypeMoq.Mock.ofType<TextDocument>();
        textEditor.setup(t => t.document).returns(() => document.object);
        document.setup(d => d.uri).returns(() => documentUri);
        documentManager.setup(d => d.activeTextEditor).returns(() => textEditor.object);
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(documentUri))).returns(() => { return { uri: documentWorkspaceFolderUri } as any; });

        const workspace = helper.getActiveWorkspaceUri();
        expect(workspace).to.be.not.equal(undefined, 'incorrect value');
        expect(workspace!.folderUri).to.be.equal(documentWorkspaceFolderUri);
        expect(workspace!.configTarget).to.be.equal(ConfigurationTarget.WorkspaceFolder);
    });
});
