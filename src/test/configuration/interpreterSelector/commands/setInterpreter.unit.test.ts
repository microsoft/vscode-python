// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, QuickPickItem, Uri } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { PathUtils } from '../../../../client/common/platform/pathUtils';
import { IPlatformService } from '../../../../client/common/platform/types';
import { IConfigurationService, IPythonSettings } from '../../../../client/common/types';
import { InterpreterQuickPickList, Interpreters } from '../../../../client/common/utils/localize';
import { IMultiStepInput, IMultiStepInputFactory } from '../../../../client/common/utils/multiStepInput';
import {
    InterpreterStateArgs,
    SetInterpreterCommand
} from '../../../../client/interpreter/configuration/interpreterSelector/commands/setInterpreter';
import {
    IInterpreterQuickPickItem,
    IInterpreterSelector,
    IPythonPathUpdaterServiceManager
} from '../../../../client/interpreter/configuration/types';

// tslint:disable-next-line:max-func-body-length
suite('Set Interpreter Command', () => {
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let interpreterSelector: TypeMoq.IMock<IInterpreterSelector>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let pythonPathUpdater: TypeMoq.IMock<IPythonPathUpdaterServiceManager>;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let multiStepInputFactory: TypeMoq.IMock<IMultiStepInputFactory>;
    const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
    const folder2 = { name: 'two', uri: Uri.parse('two'), index: 2 };

    let setInterpreterCommand: SetInterpreterCommand;

    setup(() => {
        interpreterSelector = TypeMoq.Mock.ofType<IInterpreterSelector>();
        multiStepInputFactory = TypeMoq.Mock.ofType<IMultiStepInputFactory>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        pythonPathUpdater = TypeMoq.Mock.ofType<IPythonPathUpdaterServiceManager>();
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();

        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        configurationService.setup((x) => x.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);

        setInterpreterCommand = new SetInterpreterCommand(
            appShell.object,
            new PathUtils(false),
            pythonPathUpdater.object,
            configurationService.object,
            commandManager.object,
            multiStepInputFactory.object,
            platformService.object,
            interpreterSelector.object,
            workspace.object
        );
    });

    teardown(() => {
        sinon.restore();
    });

    suite('Test method _pickInterpreter()', async () => {
        // tslint:disable-next-line: no-any
        let _enterOrBrowseInterpreterPath: sinon.SinonStub<any>;
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
            _enterOrBrowseInterpreterPath = sinon.stub(
                SetInterpreterCommand.prototype,
                '_enterOrBrowseInterpreterPath'
            );
            _enterOrBrowseInterpreterPath.resolves();
            interpreterSelector
                .setup((i) => i.getSuggestions(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve([item]));
            pythonSettings.setup((p) => p.pythonPath).returns(() => currentPythonPath);
            setInterpreterCommand = new SetInterpreterCommand(
                appShell.object,
                new PathUtils(false),
                pythonPathUpdater.object,
                configurationService.object,
                commandManager.object,
                multiStepInputFactory.object,
                platformService.object,
                interpreterSelector.object,
                workspace.object
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

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

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

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

            multiStepInput.verifyAll();
        });

        test('If an item is selected, update state and return', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(item as any));

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

            expect(state.path).to.equal(item.path, '');
        });

        test('If `Enter or browse...` option is selected, call the corresponding method with correct arguments', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(expectedEnterInterpreterPathSuggestion as any));

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

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

            await setInterpreterCommand._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            multiStepInput.verifyAll();
        });

        test('If user enters path to interpreter in the filter box, get path and update state', async () => {
            const state: InterpreterStateArgs = { path: undefined, workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve('enteredPath' as any));

            await setInterpreterCommand._enterOrBrowseInterpreterPath(multiStepInput.object, state);

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

            await setInterpreterCommand._enterOrBrowseInterpreterPath(multiStepInput.object, state);

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
                canSelectMany: false,
                title: InterpreterQuickPickList.browsePath.title()
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

            await setInterpreterCommand._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            appShell.verifyAll();
        });

        test('If `Browse...` option is selected on non-Windows, file browser is opened using expected parameters', async () => {
            const state: InterpreterStateArgs = { path: undefined, workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            const expectedParams = {
                filters: undefined,
                openLabel: InterpreterQuickPickList.browsePath.openButtonLabel(),
                canSelectMany: false,
                title: InterpreterQuickPickList.browsePath.title()
            };
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(items[0] as any));
            appShell.setup((a) => a.showOpenDialog(expectedParams)).verifiable(TypeMoq.Times.once());
            platformService.setup((p) => p.isWindows).returns(() => false);

            await setInterpreterCommand._enterOrBrowseInterpreterPath(multiStepInput.object, state);

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

            interpreterSelector.setup((i) => i.getSuggestions(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
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

            await setInterpreterCommand.setInterpreter();

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

            interpreterSelector.setup((i) => i.getSuggestions(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));

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

            await setInterpreterCommand.setInterpreter();

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

            interpreterSelector.setup((i) => i.getSuggestions(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));

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

            await setInterpreterCommand.setInterpreter();

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

            interpreterSelector
                .setup((i) => i.getSuggestions(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve([selectedItem]));
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

            await setInterpreterCommand.setInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Do not update anything when user does not select a workspace folder and there is more than one workspace folder', async () => {
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);

            interpreterSelector.setup((i) => i.getSuggestions(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
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

            await setInterpreterCommand.setInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
            multiStepInputFactory.verifyAll();
        });
        test('Make sure multiStepInput.run is called with the correct arguments', async () => {
            const pickInterpreter = sinon.stub(SetInterpreterCommand.prototype, '_pickInterpreter');
            setInterpreterCommand = new SetInterpreterCommand(
                appShell.object,
                new PathUtils(false),
                pythonPathUpdater.object,
                configurationService.object,
                commandManager.object,
                multiStepInputFactory.object,
                platformService.object,
                interpreterSelector.object,
                workspace.object
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

            interpreterSelector.setup((i) => i.getSuggestions(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
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

            await setInterpreterCommand.setInterpreter();

            expect(inputStep).to.not.equal(undefined, '');

            assert(pickInterpreter.notCalled);
            await inputStep();
            assert(pickInterpreter.calledOnce);
        });
    });
});
