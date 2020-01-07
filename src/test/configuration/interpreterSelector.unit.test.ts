// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { IFileSystem } from '../../client/common/platform/types';
import { IConfigurationService, IPythonSettings } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { InterpreterSelector } from '../../client/interpreter/configuration/interpreterSelector';
import { IInterpreterComparer, IInterpreterQuickPickItem, IPythonPathUpdaterServiceManager } from '../../client/interpreter/configuration/types';
import { IInterpreterService, InterpreterType, IShebangCodeLensProvider, PythonInterpreter } from '../../client/interpreter/contracts';

const info: PythonInterpreter = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: InterpreterType.Unknown,
    version: new SemVer('1.0.0-alpha'),
    sysPrefix: '',
    sysVersion: ''
};

class InterpreterQuickPickItem implements IInterpreterQuickPickItem {
    public path: string;
    public label: string;
    public description!: string;
    public detail?: string;
    // tslint:disable-next-line: no-any
    public interpreter = {} as any;
    constructor(l: string, p: string) {
        this.path = p;
        this.label = l;
    }
}

// tslint:disable-next-line:max-func-body-length
suite('Interpreters - selector', () => {
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let comparer: TypeMoq.IMock<IInterpreterComparer>;
    let pythonPathUpdater: TypeMoq.IMock<IPythonPathUpdaterServiceManager>;
    let shebangProvider: TypeMoq.IMock<IShebangCodeLensProvider>;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;

    class TestInterpreterSelector extends InterpreterSelector {
        // tslint:disable-next-line:no-unnecessary-override
        public async suggestionToQuickPickItem(suggestion: PythonInterpreter, workspaceUri?: Uri): Promise<IInterpreterQuickPickItem> {
            return super.suggestionToQuickPickItem(suggestion, workspaceUri);
        }
        // tslint:disable-next-line:no-unnecessary-override
        public async setInterpreter() {
            return super.setInterpreter();
        }
        // tslint:disable-next-line:no-unnecessary-override
        public async setShebangInterpreter() {
            return super.setShebangInterpreter();
        }
    }
    setup(() => {
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        comparer = TypeMoq.Mock.ofType<IInterpreterComparer>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        pythonPathUpdater = TypeMoq.Mock.ofType<IPythonPathUpdaterServiceManager>();
        shebangProvider = TypeMoq.Mock.ofType<IShebangCodeLensProvider>();
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();

        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem.setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns((a: string, b: string) => a === b);
        fileSystem.setup(x => x.getRealPath(TypeMoq.It.isAnyString())).returns((a: string) => new Promise(resolve => resolve(a)));
        configurationService.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

        comparer.setup(c => c.compare(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => 0);
    });

    [true, false].forEach(isWindows => {
        test(`Suggestions (${isWindows ? 'Windows' : 'Non-Windows'})`, async () => {
            const selector = new InterpreterSelector(
                interpreterService.object,
                workspace.object,
                appShell.object,
                documentManager.object,
                new PathUtils(isWindows),
                comparer.object,
                pythonPathUpdater.object,
                shebangProvider.object,
                configurationService.object,
                commandManager.object
            );

            const initial: PythonInterpreter[] = [
                { displayName: '1', path: 'c:/path1/path1', type: InterpreterType.Unknown },
                { displayName: '2', path: 'c:/path1/path1', type: InterpreterType.Unknown },
                { displayName: '2', path: 'c:/path2/path2', type: InterpreterType.Unknown },
                { displayName: '2 (virtualenv)', path: 'c:/path2/path2', type: InterpreterType.VirtualEnv },
                { displayName: '3', path: 'c:/path2/path2', type: InterpreterType.Unknown },
                { displayName: '4', path: 'c:/path4/path4', type: InterpreterType.Conda }
            ].map(item => {
                return { ...info, ...item };
            });
            interpreterService.setup(x => x.getInterpreters(TypeMoq.It.isAny())).returns(() => new Promise(resolve => resolve(initial)));

            const actual = await selector.getSuggestions(undefined);

            const expected: InterpreterQuickPickItem[] = [
                new InterpreterQuickPickItem('1', 'c:/path1/path1'),
                new InterpreterQuickPickItem('2', 'c:/path1/path1'),
                new InterpreterQuickPickItem('2', 'c:/path2/path2'),
                new InterpreterQuickPickItem('2 (virtualenv)', 'c:/path2/path2'),
                new InterpreterQuickPickItem('3', 'c:/path2/path2'),
                new InterpreterQuickPickItem('4', 'c:/path4/path4')
            ];

            assert.equal(actual.length, expected.length, 'Suggestion lengths are different.');
            for (let i = 0; i < expected.length; i += 1) {
                assert.equal(actual[i].label, expected[i].label, `Suggestion label is different at ${i}: exected '${expected[i].label}', found '${actual[i].label}'.`);
                assert.equal(actual[i].path, expected[i].path, `Suggestion path is different at ${i}: exected '${expected[i].path}', found '${actual[i].path}'.`);
            }
        });
    });

    test('Update Global settings when there are no workspaces', async () => {
        const selector = new TestInterpreterSelector(
            interpreterService.object,
            workspace.object,
            appShell.object,
            documentManager.object,
            new PathUtils(false),
            comparer.object,
            pythonPathUpdater.object,
            shebangProvider.object,
            configurationService.object,
            commandManager.object
        );
        pythonSettings.setup(p => p.pythonPath).returns(() => 'python');
        const selectedItem: IInterpreterQuickPickItem = {
            description: '',
            detail: '',
            label: '',
            path: 'This is the selected Python path',
            // tslint:disable-next-line: no-any
            interpreter: {} as any
        };

        workspace.setup(w => w.workspaceFolders).returns(() => undefined);

        selector.getSuggestions = () => Promise.resolve([]);
        appShell
            .setup(s => s.showQuickPick<IInterpreterQuickPickItem>(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(selectedItem))
            .verifiable(TypeMoq.Times.once());
        pythonPathUpdater
            .setup(p =>
                p.updatePythonPath(TypeMoq.It.isValue(selectedItem.path), TypeMoq.It.isValue(ConfigurationTarget.Global), TypeMoq.It.isValue('ui'), TypeMoq.It.isValue(undefined))
            )
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await selector.setInterpreter();

        appShell.verifyAll();
        workspace.verifyAll();
        pythonPathUpdater.verifyAll();
    });
    test('Update workspace folder settings when there is one workspace folder', async () => {
        const selector = new TestInterpreterSelector(
            interpreterService.object,
            workspace.object,
            appShell.object,
            documentManager.object,
            new PathUtils(false),
            comparer.object,
            pythonPathUpdater.object,
            shebangProvider.object,
            configurationService.object,
            commandManager.object
        );
        pythonSettings.setup(p => p.pythonPath).returns(() => 'python');
        const selectedItem: IInterpreterQuickPickItem = {
            description: '',
            detail: '',
            label: '',
            path: 'This is the selected Python path',
            // tslint:disable-next-line: no-any
            interpreter: {} as any
        };

        const folder = { name: 'one', uri: Uri.parse('one'), index: 0 };
        workspace.setup(w => w.workspaceFolders).returns(() => [folder]);

        selector.getSuggestions = () => Promise.resolve([]);
        appShell
            .setup(s => s.showQuickPick<IInterpreterQuickPickItem>(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(selectedItem))
            .verifiable(TypeMoq.Times.once());
        pythonPathUpdater
            .setup(p =>
                p.updatePythonPath(
                    TypeMoq.It.isValue(selectedItem.path),
                    TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                    TypeMoq.It.isValue('ui'),
                    TypeMoq.It.isValue(folder.uri)
                )
            )
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await selector.setInterpreter();

        appShell.verifyAll();
        workspace.verifyAll();
        pythonPathUpdater.verifyAll();
    });
    test('Update seleted workspace folder settings when there is more than one workspace folder', async () => {
        const selector = new TestInterpreterSelector(
            interpreterService.object,
            workspace.object,
            appShell.object,
            documentManager.object,
            new PathUtils(false),
            comparer.object,
            pythonPathUpdater.object,
            shebangProvider.object,
            configurationService.object,
            commandManager.object
        );
        pythonSettings.setup(p => p.pythonPath).returns(() => 'python');
        const selectedItem: IInterpreterQuickPickItem = {
            description: '',
            detail: '',
            label: '',
            path: 'This is the selected Python path',
            // tslint:disable-next-line: no-any
            interpreter: {} as any
        };

        const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
        const folder2 = { name: 'two', uri: Uri.parse('two'), index: 2 };
        workspace.setup(w => w.workspaceFolders).returns(() => [folder1, folder2]);

        selector.getSuggestions = () => Promise.resolve([]);
        appShell
            .setup(s => s.showQuickPick<IInterpreterQuickPickItem>(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(selectedItem))
            .verifiable(TypeMoq.Times.once());
        appShell
            .setup(s => s.showWorkspaceFolderPick(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(folder2))
            .verifiable(TypeMoq.Times.once());
        pythonPathUpdater
            .setup(p =>
                p.updatePythonPath(
                    TypeMoq.It.isValue(selectedItem.path),
                    TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                    TypeMoq.It.isValue('ui'),
                    TypeMoq.It.isValue(folder2.uri)
                )
            )
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await selector.setInterpreter();

        appShell.verifyAll();
        workspace.verifyAll();
        pythonPathUpdater.verifyAll();
    });
    test('Do not update anything when user does not select a workspace folder and there is more than one workspace folder', async () => {
        const selector = new TestInterpreterSelector(
            interpreterService.object,
            workspace.object,
            appShell.object,
            documentManager.object,
            new PathUtils(false),
            comparer.object,
            pythonPathUpdater.object,
            shebangProvider.object,
            configurationService.object,
            commandManager.object
        );

        const selectedItem: IInterpreterQuickPickItem = {
            description: '',
            detail: '',
            label: '',
            path: 'This is the selected Python path',
            // tslint:disable-next-line: no-any
            interpreter: {} as any
        };

        const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
        const folder2 = { name: 'two', uri: Uri.parse('two'), index: 2 };
        workspace.setup(w => w.workspaceFolders).returns(() => [folder1, folder2]);

        selector.getSuggestions = () => Promise.resolve([]);
        appShell
            .setup(s => s.showQuickPick<IInterpreterQuickPickItem>(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(selectedItem))
            .verifiable(TypeMoq.Times.never());
        appShell
            .setup(s => s.showWorkspaceFolderPick(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        pythonPathUpdater
            .setup(p => p.updatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        await selector.setInterpreter();

        appShell.verifyAll();
        workspace.verifyAll();
        pythonPathUpdater.verifyAll();
    });
});
