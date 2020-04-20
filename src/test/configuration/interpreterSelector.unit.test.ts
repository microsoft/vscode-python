// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, QuickPickItem, Uri } from 'vscode';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWorkspaceService
} from '../../client/common/application/types';
import { DeprecatePythonPath } from '../../client/common/experimentGroups';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IExperimentsManager, IPythonSettings } from '../../client/common/types';
import { InterpreterQuickPickList, Interpreters } from '../../client/common/utils/localize';
import { IMultiStepInput, IMultiStepInputFactory } from '../../client/common/utils/multiStepInput';
import { Architecture } from '../../client/common/utils/platform';
import { IInterpreterSecurityService } from '../../client/interpreter/autoSelection/types';
import { InterpreterSelector } from '../../client/interpreter/configuration/interpreterSelector';
import {
    IInterpreterComparer,
    IInterpreterQuickPickItem,
    InterpreterStateArgs,
    IPythonPathUpdaterServiceManager
} from '../../client/interpreter/configuration/types';
import {
    IInterpreterService,
    InterpreterType,
    IShebangCodeLensProvider,
    PythonInterpreter
} from '../../client/interpreter/contracts';

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
    let experimentsManager: TypeMoq.IMock<IExperimentsManager>;
    let interpreterSecurityService: TypeMoq.IMock<IInterpreterSecurityService>;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let multiStepInputFactory: TypeMoq.IMock<IMultiStepInputFactory>;
    const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
    const folder2 = { name: 'two', uri: Uri.parse('two'), index: 2 };

    class TestInterpreterSelector extends InterpreterSelector {
        // tslint:disable-next-line:no-unnecessary-override
        public async suggestionToQuickPickItem(
            suggestion: PythonInterpreter,
            workspaceUri?: Uri
        ): Promise<IInterpreterQuickPickItem> {
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
        // tslint:disable-next-line:no-unnecessary-override
        public async resetInterpreter() {
            return super.resetInterpreter();
        }
    }

    let selector: TestInterpreterSelector;

    setup(() => {
        multiStepInputFactory = TypeMoq.Mock.ofType<IMultiStepInputFactory>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        experimentsManager = TypeMoq.Mock.ofType<IExperimentsManager>();
        experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
        experimentsManager
            .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
            .returns(() => undefined);
        interpreterSecurityService = TypeMoq.Mock.ofType<IInterpreterSecurityService>();
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
        fileSystem
            .setup((x) => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a: string, b: string) => a === b);
        configurationService.setup((x) => x.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

        comparer.setup((c) => c.compare(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => 0);
        selector = new TestInterpreterSelector(
            interpreterService.object,
            workspace.object,
            appShell.object,
            documentManager.object,
            new PathUtils(false),
            comparer.object,
            pythonPathUpdater.object,
            shebangProvider.object,
            configurationService.object,
            commandManager.object,
            experimentsManager.object,
            interpreterSecurityService.object,
            multiStepInputFactory.object,
            platformService.object
        );
    });

    teardown(() => {
        sinon.restore();
    });

    [true, false].forEach((isWindows) => {
        test(`Suggestions (${isWindows ? 'Windows' : 'Non-Windows'})`, async () => {
            const interpreterSelector = new InterpreterSelector(
                interpreterService.object,
                workspace.object,
                appShell.object,
                documentManager.object,
                new PathUtils(isWindows),
                comparer.object,
                pythonPathUpdater.object,
                shebangProvider.object,
                configurationService.object,
                commandManager.object,
                experimentsManager.object,
                interpreterSecurityService.object,
                multiStepInputFactory.object,
                platformService.object
            );

            const initial: PythonInterpreter[] = [
                { displayName: '1', path: 'c:/path1/path1', type: InterpreterType.Unknown },
                { displayName: '2', path: 'c:/path1/path1', type: InterpreterType.Unknown },
                { displayName: '2', path: 'c:/path2/path2', type: InterpreterType.Unknown },
                { displayName: '2 (virtualenv)', path: 'c:/path2/path2', type: InterpreterType.VirtualEnv },
                { displayName: '3', path: 'c:/path2/path2', type: InterpreterType.Unknown },
                { displayName: '4', path: 'c:/path4/path4', type: InterpreterType.Conda }
            ].map((item) => {
                return { ...info, ...item };
            });
            interpreterService
                .setup((x) => x.getInterpreters(TypeMoq.It.isAny()))
                .returns(() => new Promise((resolve) => resolve(initial)));

            const actual = await interpreterSelector.getSuggestions(undefined);

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
                assert.equal(
                    actual[i].label,
                    expected[i].label,
                    `Suggestion label is different at ${i}: exected '${expected[i].label}', found '${actual[i].label}'.`
                );
                assert.equal(
                    actual[i].path,
                    expected[i].path,
                    `Suggestion path is different at ${i}: exected '${expected[i].path}', found '${actual[i].path}'.`
                );
            }
        });
    });

    test('When in Deprecate PythonPath experiment, remove unsafe interpreters from the suggested interpreters list', async () => {
        // tslint:disable-next-line: no-any
        const interpreterList = ['interpreter1', 'interpreter2', 'interpreter3'] as any;
        interpreterService.setup((i) => i.getInterpreters(folder1.uri)).returns(() => interpreterList);
        // tslint:disable-next-line: no-any
        interpreterSecurityService.setup((i) => i.isSafe('interpreter1' as any)).returns(() => true);
        // tslint:disable-next-line: no-any
        interpreterSecurityService.setup((i) => i.isSafe('interpreter2' as any)).returns(() => false);
        // tslint:disable-next-line: no-any
        interpreterSecurityService.setup((i) => i.isSafe('interpreter3' as any)).returns(() => undefined);
        experimentsManager.reset();
        experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
        experimentsManager
            .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
            .returns(() => undefined);
        // tslint:disable-next-line: no-any
        selector.suggestionToQuickPickItem = (item, _) => Promise.resolve(item as any);
        const suggestion = await selector.getSuggestions(folder1.uri);
        assert.deepEqual(suggestion, ['interpreter1', 'interpreter3']);
    });

    suite('Test method _enterOrBrowseInterpreterPath()', async () => {
        // tslint:disable-next-line: no-any
        let _enterOrBrowseInterpreterPath: sinon.SinonStub<any>;
        // tslint:disable-next-line: no-any
        let getSuggestions: sinon.SinonStub<any>;
        const item: IInterpreterQuickPickItem = {
            description: '',
            detail: '',
            label: '',
            path: 'This is the selected Python path',
            // tslint:disable-next-line: no-any
            interpreter: {} as any
        };
        const expectedEnterInterpreterPathSuggestion = {
            label: InterpreterQuickPickList.enterPath.label(),
            detail: InterpreterQuickPickList.enterPath.detail(),
            alwaysShow: true
        };
        const currentPythonPath = 'python';
        setup(() => {
            _enterOrBrowseInterpreterPath = sinon.stub(InterpreterSelector.prototype, '_enterOrBrowseInterpreterPath');
            _enterOrBrowseInterpreterPath.resolves();
            getSuggestions = sinon.stub(InterpreterSelector.prototype, 'getSuggestions');
            getSuggestions.resolves([item]);
            pythonSettings.setup((p) => p.pythonPath).returns(() => currentPythonPath);
            selector = new TestInterpreterSelector(
                interpreterService.object,
                workspace.object,
                appShell.object,
                documentManager.object,
                new PathUtils(false),
                comparer.object,
                pythonPathUpdater.object,
                shebangProvider.object,
                configurationService.object,
                commandManager.object,
                experimentsManager.object,
                interpreterSecurityService.object,
                multiStepInputFactory.object,
                platformService.object
            );
        });
        teardown(() => {
            sinon.restore();
        });

        test('Existing state path must be removed before displaying picker', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(undefined as any));

            await selector._pickInterpreter(multiStepInput.object, state);

            expect(state.path).to.equal(undefined, '');
        });

        test('Picker should be displayed with expected items', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            const suggestions = [expectedEnterInterpreterPathSuggestion, item];
            const expectedParameters = {
                placeholder: InterpreterQuickPickList.quickPickListPlaceholder().format(currentPythonPath),
                items: suggestions,
                activeItem: item,
                matchOnDetail: true,
                matchOnDescription: true
            };
            multiStepInput
                .setup((i) => i.showQuickPick(expectedParameters))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(undefined as any))
                .verifiable(TypeMoq.Times.once());

            await selector._pickInterpreter(multiStepInput.object, state);

            multiStepInput.verifyAll();
        });

        test('If an item is selected, update state and return', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(item as any));

            await selector._pickInterpreter(multiStepInput.object, state);

            expect(state.path).to.equal(item.path, '');
        });

        test('If `Enter or browse...` option is selected, call the corresponding method with correct arguments', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(expectedEnterInterpreterPathSuggestion as any));

            await selector._pickInterpreter(multiStepInput.object, state);

            assert(
                _enterOrBrowseInterpreterPath.calledOnceWith(multiStepInput.object, {
                    path: undefined,
                    workspace: undefined
                })
            );
        });
    });

    suite('Test method _enterOrBrowseInterpreterPath()', async () => {
        const items: QuickPickItem[] = [
            {
                label: InterpreterQuickPickList.browsePath.label(),
                detail: InterpreterQuickPickList.browsePath.detail()
            }
        ];
        const expectedParameters = {
            placeholder: InterpreterQuickPickList.enterPath.placeholder(),
            items,
            acceptFilterBoxTextAsSelection: true
        };

        test('Picker should be displayed with expected items', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(expectedParameters))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(undefined as any))
                .verifiable(TypeMoq.Times.once());

            await selector._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            multiStepInput.verifyAll();
        });

        test('If user enters path to interpreter in the filter box, get path and update state', async () => {
            const state: InterpreterStateArgs = { path: undefined, workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve('enteredPath' as any));

            await selector._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            expect(state.path).to.equal('enteredPath', '');
        });

        test('If `Browse...` is selected, open the file browser to get path and update state', async () => {
            const state: InterpreterStateArgs = { path: undefined, workspace: undefined };
            const expectedPathUri = Uri.parse('browsed path');
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(items[0] as any));
            appShell
                .setup((a) => a.showOpenDialog(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve([expectedPathUri]));

            await selector._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            expect(state.path).to.equal(expectedPathUri.fsPath, '');
        });

        test('If `Browse...` option is selected on Windows, file browser is opened using expected parameters', async () => {
            const state: InterpreterStateArgs = { path: undefined, workspace: undefined };
            const filtersKey = 'Executables';
            const filtersObject: { [name: string]: string[] } = {};
            filtersObject[filtersKey] = ['exe'];
            const expectedParams = {
                filters: filtersObject,
                openLabel: InterpreterQuickPickList.browsePath.openButtonLabel(),
                canSelectMany: false
            };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(items[0] as any));
            appShell
                // tslint:disable-next-line: no-any
                .setup((a) => a.showOpenDialog(expectedParams as any))
                .verifiable(TypeMoq.Times.once());
            platformService.setup((p) => p.isWindows).returns(() => true);

            await selector._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            appShell.verifyAll();
        });

        test('If `Browse...` option is selected on non-Windows, file browser is opened using expected parameters', async () => {
            const state: InterpreterStateArgs = { path: undefined, workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            const expectedParams = {
                filters: undefined,
                openLabel: InterpreterQuickPickList.browsePath.openButtonLabel(),
                canSelectMany: false
            };
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(items[0] as any));
            appShell.setup((a) => a.showOpenDialog(expectedParams)).verifiable(TypeMoq.Times.once());
            platformService.setup((p) => p.isWindows).returns(() => false);

            await selector._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            appShell.verifyAll();
        });
    });
    // tslint:disable-next-line: max-func-body-length
    suite('Test method setInterpreter()', async () => {
        test('Update Global settings when there are no workspaces', async () => {
            pythonSettings.setup((p) => p.pythonPath).returns(() => 'python');
            const selectedItem: IInterpreterQuickPickItem = {
                description: '',
                detail: '',
                label: '',
                path: 'This is the selected Python path',
                // tslint:disable-next-line: no-any
                interpreter: {} as any
            };

            workspace.setup((w) => w.workspaceFolders).returns(() => undefined);

            selector.getSuggestions = () => Promise.resolve([]);
            const multiStepInput = {
                // tslint:disable-next-line: no-any
                run: (_: any, state: InterpreterStateArgs) => {
                    state.path = selectedItem.path;
                    return Promise.resolve();
                }
            };
            multiStepInputFactory
                .setup((f) => f.create())
                // tslint:disable-next-line: no-any
                .returns(() => multiStepInput as any);
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(selectedItem.path),
                        TypeMoq.It.isValue(ConfigurationTarget.Global),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(undefined)
                    )
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await selector.setInterpreter();

            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Update workspace folder settings when there is one workspace folder and no workspace file', async () => {
            pythonSettings.setup((p) => p.pythonPath).returns(() => 'python');
            workspace.setup((w) => w.workspaceFile).returns(() => undefined);
            const selectedItem: IInterpreterQuickPickItem = {
                description: '',
                detail: '',
                label: '',
                path: 'This is the selected Python path',
                // tslint:disable-next-line: no-any
                interpreter: {} as any
            };

            const folder = { name: 'one', uri: Uri.parse('one'), index: 0 };
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder]);

            selector.getSuggestions = () => Promise.resolve([]);

            const multiStepInput = {
                // tslint:disable-next-line: no-any
                run: (_: any, state: InterpreterStateArgs) => {
                    state.path = selectedItem.path;
                    return Promise.resolve();
                }
            };
            multiStepInputFactory
                .setup((f) => f.create())
                // tslint:disable-next-line: no-any
                .returns(() => multiStepInput as any);

            pythonPathUpdater
                .setup((p) =>
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

            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Update selected workspace folder settings when there is more than one workspace folder', async () => {
            pythonSettings.setup((p) => p.pythonPath).returns(() => 'python');
            const selectedItem: IInterpreterQuickPickItem = {
                description: '',
                detail: '',
                label: '',
                path: 'This is the selected Python path',
                // tslint:disable-next-line: no-any
                interpreter: {} as any
            };

            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);
            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri
                }
            ];
            selector.getSuggestions = () => Promise.resolve([]);

            const multiStepInput = {
                // tslint:disable-next-line: no-any
                run: (_: any, state: InterpreterStateArgs) => {
                    state.path = selectedItem.path;
                    return Promise.resolve();
                }
            };
            multiStepInputFactory
                .setup((f) => f.create())
                // tslint:disable-next-line: no-any
                .returns(() => multiStepInput as any);
            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() =>
                    Promise.resolve({
                        label: 'two',
                        description: path.dirname(folder2.uri.fsPath),
                        uri: folder2.uri
                    })
                )
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
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
        test('Update entire workspace settings when there is more than one workspace folder and `Entire workspace` is selected', async () => {
            pythonSettings.setup((p) => p.pythonPath).returns(() => 'python');
            const selectedItem: IInterpreterQuickPickItem = {
                description: '',
                detail: '',
                label: '',
                path: 'This is the selected Python path',
                // tslint:disable-next-line: no-any
                interpreter: {} as any
            };

            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);
            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri
                }
            ];
            selector.getSuggestions = () => Promise.resolve([selectedItem]);
            const multiStepInput = {
                // tslint:disable-next-line: no-any
                run: (_: any, state: InterpreterStateArgs) => {
                    state.path = selectedItem.path;
                    return Promise.resolve();
                }
            };
            multiStepInputFactory
                .setup((f) => f.create())
                // tslint:disable-next-line: no-any
                .returns(() => multiStepInput as any);
            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() =>
                    Promise.resolve({
                        label: Interpreters.entireWorkspace(),
                        uri: folder1.uri
                    })
                )
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(selectedItem.path),
                        TypeMoq.It.isValue(ConfigurationTarget.Workspace),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder1.uri)
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
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);

            selector.getSuggestions = () => Promise.resolve([]);
            multiStepInputFactory
                .setup((f) => f.create())
                // tslint:disable-next-line: no-any
                .verifiable(TypeMoq.Times.never());

            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri
                }
            ];

            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());

            await selector.setInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
            multiStepInputFactory.verifyAll();
        });
        test('Make sure multiStepInput.run is called with the correct arguments', async () => {
            const pickInterpreter = sinon.stub(InterpreterSelector.prototype, '_pickInterpreter');
            selector = new TestInterpreterSelector(
                interpreterService.object,
                workspace.object,
                appShell.object,
                documentManager.object,
                new PathUtils(false),
                comparer.object,
                pythonPathUpdater.object,
                shebangProvider.object,
                configurationService.object,
                commandManager.object,
                experimentsManager.object,
                interpreterSecurityService.object,
                multiStepInputFactory.object,
                platformService.object
            );
            let inputStep!: Function;
            pythonSettings.setup((p) => p.pythonPath).returns(() => 'python');
            const selectedItem: IInterpreterQuickPickItem = {
                description: '',
                detail: '',
                label: '',
                path: 'This is the selected Python path',
                // tslint:disable-next-line: no-any
                interpreter: {} as any
            };

            workspace.setup((w) => w.workspaceFolders).returns(() => undefined);

            selector.getSuggestions = () => Promise.resolve([]);
            const multiStepInput = {
                // tslint:disable-next-line: no-any
                run: (inputStepArg: any, state: InterpreterStateArgs) => {
                    inputStep = inputStepArg;
                    state.path = selectedItem.path;
                    return Promise.resolve();
                }
            };
            multiStepInputFactory
                .setup((f) => f.create())
                // tslint:disable-next-line: no-any
                .returns(() => multiStepInput as any);
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(selectedItem.path),
                        TypeMoq.It.isValue(ConfigurationTarget.Global),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(undefined)
                    )
                )
                .returns(() => Promise.resolve());

            await selector.setInterpreter();

            expect(inputStep).to.not.equal(undefined, '');

            assert(pickInterpreter.notCalled);
            await inputStep();
            assert(pickInterpreter.calledOnce);
        });
    });

    // tslint:disable-next-line: max-func-body-length
    suite('Test method resetInterpreter()', async () => {
        test('Update Global settings when there are no workspaces', async () => {
            workspace.setup((w) => w.workspaceFolders).returns(() => undefined);

            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(undefined),
                        TypeMoq.It.isValue(ConfigurationTarget.Global),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(undefined)
                    )
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await selector.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Update workspace folder settings when there is one workspace folder and no workspace file', async () => {
            const folder = { name: 'one', uri: Uri.parse('one'), index: 0 };
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder]);
            workspace.setup((w) => w.workspaceFile).returns(() => undefined);

            selector.getSuggestions = () => Promise.resolve([]);
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(undefined),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder.uri)
                    )
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await selector.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Update selected workspace folder settings when there is more than one workspace folder', async () => {
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);
            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri
                }
            ];
            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() =>
                    Promise.resolve({
                        label: 'two',
                        description: path.dirname(folder2.uri.fsPath),
                        uri: folder2.uri
                    })
                )
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(undefined),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder2.uri)
                    )
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await selector.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Update entire workspace settings when there is more than one workspace folder and `Entire workspace` is selected', async () => {
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);
            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri
                }
            ];
            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() =>
                    Promise.resolve({
                        label: Interpreters.entireWorkspace(),
                        uri: folder1.uri
                    })
                )
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(undefined),
                        TypeMoq.It.isValue(ConfigurationTarget.Workspace),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder1.uri)
                    )
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await selector.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Do not update anything when user does not select a workspace folder and there is more than one workspace folder', async () => {
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);

            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri
                }
            ];

            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());

            await selector.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
    });
});
