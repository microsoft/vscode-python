// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { IConfigurationService } from '../../client/common/types';
import { PythonFormattingEditProvider } from '../../client/providers/formatProvider';
import { closeActiveWindows } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const unformattedFile = path.join(formatFilesPath, 'fileToFormat.py');

suite('Formating On Save', () => {
    let ioc: UnitTestIocContainer;
    let config: TypeMoq.IMock<IConfigurationService>;
    let editorConfig: TypeMoq.IMock<vscode.WorkspaceConfiguration>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let commands: TypeMoq.IMock<ICommandManager>;
    let options: TypeMoq.IMock<vscode.FormattingOptions>;
    let listener: (d: vscode.TextDocument) => Promise<void>;

    setup(initializeDI);
    suiteTeardown(async () => {
        await closeActiveWindows();
    });
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerFormatterTypes();
        ioc.registerFileSystemTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerMockProcess();

        config = TypeMoq.Mock.ofType<IConfigurationService>();
        config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => PythonSettings.getInstance());

        editorConfig = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();

        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspace.setup(x => x.getConfiguration('editor', TypeMoq.It.isAny())).returns(() => editorConfig.object);

        const event = TypeMoq.Mock.ofType<vscode.Event<vscode.TextDocument>>();
        event.setup(x => x(TypeMoq.It.isAny())).callback((s) => {
            listener = s as ((d: vscode.TextDocument) => Promise<void>);
            // tslint:disable-next-line:no-empty
        }).returns(() => new vscode.Disposable(() => { }));

        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        documentManager.setup(x => x.onDidSaveTextDocument).returns(() => event.object);

        options = TypeMoq.Mock.ofType<vscode.FormattingOptions>();
        options.setup(x => x.insertSpaces).returns(() => true);
        options.setup(x => x.tabSize).returns(() => 4);

        commands = TypeMoq.Mock.ofType<ICommandManager>();
        commands.setup(x => x.executeCommand('editor.action.formatDocument')).returns(() =>
            new Promise((resolve, reject) => resolve())
        );
        ioc.serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, config.object);
        ioc.serviceManager.addSingletonInstance<ICommandManager>(ICommandManager, commands.object);
        ioc.serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);
        ioc.serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, documentManager.object);
    }

    test('Workaround VS Code 41194', async () => {
        editorConfig.setup(x => x.get('formatOnSave')).returns(() => true);

        const content = await fs.readFile(unformattedFile, 'utf8');
        let version = 1;

        const document = TypeMoq.Mock.ofType<vscode.TextDocument>();
        document.setup(x => x.getText()).returns(() => content);
        document.setup(x => x.uri).returns(() => vscode.Uri.file(unformattedFile));
        document.setup(x => x.isDirty).returns(() => false);
        document.setup(x => x.fileName).returns(() => unformattedFile);
        document.setup(x => x.save()).callback(() => version += 1);
        document.setup(x => x.version).returns(() => version);

        const context = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
        const provider = new PythonFormattingEditProvider(context.object, ioc.serviceContainer);
        const edits = await provider.provideDocumentFormattingEdits(document.object, options.object, new vscode.CancellationTokenSource().token);
        expect(edits.length).be.greaterThan(0, 'Formatter produced no edits');

        await listener(document.object);
        await new Promise<void>((resolve, reject) => setTimeout(resolve, 500));

        commands.verify(x => x.executeCommand('editor.action.formatDocument'), TypeMoq.Times.once());
        document.verify(x => x.save(), TypeMoq.Times.once());
    });
});
