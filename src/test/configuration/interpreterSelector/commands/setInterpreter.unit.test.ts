// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, OpenDialogOptions, QuickPickItem, Uri } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { PathUtils } from '../../../../client/common/platform/pathUtils';
import { IPlatformService } from '../../../../client/common/platform/types';
import { IConfigurationService, IExperimentService, IPythonSettings } from '../../../../client/common/types';
import { InterpreterQuickPickList, Interpreters } from '../../../../client/common/utils/localize';
import { IMultiStepInput, IMultiStepInputFactory, InputStep } from '../../../../client/common/utils/multiStepInput';
import {
    InterpreterStateArgs,
    SetInterpreterCommand,
} from '../../../../client/interpreter/configuration/interpreterSelector/commands/setInterpreter';
import {
    IInterpreterQuickPickItem,
    IInterpreterSelector,
    IPythonPathUpdaterServiceManager,
} from '../../../../client/interpreter/configuration/types';
import { PythonEnvironment } from '../../../../client/pythonEnvironments/info';
import { EventName } from '../../../../client/telemetry/constants';
import * as Telemetry from '../../../../client/telemetry';
import { FindInterpreterVariants } from '../../../../client/common/experiments/groups';

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
    let experimentService: TypeMoq.IMock<IExperimentService>;
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

        experimentService = TypeMoq.Mock.ofType<IExperimentService>();
        experimentService
            .setup((x) => x.inExperiment(TypeMoq.It.isValue(FindInterpreterVariants.findLast)))
            .returns(() => Promise.resolve(false));

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
            workspace.object,
            experimentService.object,
        );
    });

    teardown(() => {
        sinon.restore();
    });

    suite('Test method _pickInterpreter()', async () => {
        let _enterOrBrowseInterpreterPath: sinon.SinonStub;
        let sendTelemetryStub: sinon.SinonStub;
        let telemetryEvent: { eventName: EventName; properties: { userAction: string } } | undefined;

        const item: IInterpreterQuickPickItem = {
            description: '',
            detail: '',
            label: '',
            path: 'This is the selected Python path',
            interpreter: {} as PythonEnvironment,
        };
        const expectedEnterInterpreterPathSuggestion = {
            label: InterpreterQuickPickList.enterPath.label(),
            detail: InterpreterQuickPickList.enterPath.detail(),
            alwaysShow: true,
        };
        const expectedFindInterpreterPathSuggestion = {
            label: InterpreterQuickPickList.findPath.label(),
            detail: InterpreterQuickPickList.findPath.detail(),
            alwaysShow: true,
        };
        const currentPythonPath = 'python';

        setup(() => {
            _enterOrBrowseInterpreterPath = sinon.stub(
                SetInterpreterCommand.prototype,
                '_enterOrBrowseInterpreterPath',
            );
            _enterOrBrowseInterpreterPath.resolves();
            sendTelemetryStub = sinon
                .stub(Telemetry, 'sendTelemetryEvent')
                .callsFake((eventName: EventName, _, properties: { userAction: string }) => {
                    telemetryEvent = {
                        eventName,
                        properties,
                    };
                });
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
                workspace.object,
                experimentService.object,
            );
        });
        teardown(() => {
            telemetryEvent = undefined;
            sinon.restore();
            Telemetry._resetSharedProperties();
        });

        test('Existing state path must be removed before displaying picker', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined as unknown));

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

            expect(state.path).to.equal(undefined, '');
        });

        test('Picker should be displayed with expected items: Not in find path experiment', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            const suggestions = [expectedEnterInterpreterPathSuggestion, item];
            const expectedParameters = {
                placeholder: InterpreterQuickPickList.quickPickListPlaceholder().format(currentPythonPath),
                items: suggestions,
                activeItem: item,
                matchOnDetail: true,
                matchOnDescription: true,
            };
            multiStepInput
                .setup((i) => i.showQuickPick(expectedParameters))
                .returns(() => Promise.resolve((undefined as unknown) as QuickPickItem))
                .verifiable(TypeMoq.Times.once());

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

            multiStepInput.verifyAll();
        });

        test('Picker should be displayed with expected items: In find path experiment', async () => {
            const experiments = TypeMoq.Mock.ofType<IExperimentService>();
            experiments
                .setup((x) => x.inExperiment(TypeMoq.It.isValue(FindInterpreterVariants.findLast)))
                .returns(() => Promise.resolve(true));

            const inExpSetInterpreterCommand = new SetInterpreterCommand(
                appShell.object,
                new PathUtils(false),
                pythonPathUpdater.object,
                configurationService.object,
                commandManager.object,
                multiStepInputFactory.object,
                platformService.object,
                interpreterSelector.object,
                workspace.object,
                experiments.object,
            );

            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            const suggestions = [item, expectedFindInterpreterPathSuggestion];
            const expectedParameters = {
                placeholder: InterpreterQuickPickList.quickPickListPlaceholder().format(currentPythonPath),
                items: suggestions,
                activeItem: item,
                matchOnDetail: true,
                matchOnDescription: true,
            };
            multiStepInput
                .setup((i) => i.showQuickPick(expectedParameters))
                .returns(() => Promise.resolve((undefined as unknown) as QuickPickItem))
                .verifiable(TypeMoq.Times.once());

            await inExpSetInterpreterCommand._pickInterpreter(multiStepInput.object, state);

            multiStepInput.verifyAll();
        });

        test('If an item is selected, update state and return', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput.setup((i) => i.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve(item));

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

            expect(state.path).to.equal(item.path, '');
        });

        test('If an item is selected, send SELECT_INTERPRETER_SELECTED telemetry with the "selected" property value', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput.setup((i) => i.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve(item));

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

            sinon.assert.calledOnce(sendTelemetryStub);
            assert.deepStrictEqual(telemetryEvent, {
                eventName: EventName.SELECT_INTERPRETER_SELECTED,
                properties: { action: 'selected' },
            });
        });

        test('If the dropdown is dismissed, send SELECT_INTERPRETER_SELECTED telemetry with the "escape" property value', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput.setup((i) => i.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

            sinon.assert.calledOnce(sendTelemetryStub);
            assert.deepStrictEqual(telemetryEvent, {
                eventName: EventName.SELECT_INTERPRETER_SELECTED,
                properties: { action: 'escape' },
            });
        });

        test('If `Enter or browse...` option is selected, call the corresponding method with correct arguments', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(expectedEnterInterpreterPathSuggestion));

            await setInterpreterCommand._pickInterpreter(multiStepInput.object, state);

            assert(
                _enterOrBrowseInterpreterPath.calledOnceWith(multiStepInput.object, {
                    path: undefined,
                    workspace: undefined,
                }),
            );
        });
    });

    suite('Test method _enterOrBrowseInterpreterPath()', async () => {
        const items: QuickPickItem[] = [
            {
                label: InterpreterQuickPickList.browsePath.label(),
                detail: InterpreterQuickPickList.browsePath.detail(),
            },
        ];
        const expectedParameters = {
            placeholder: InterpreterQuickPickList.enterPath.placeholder(),
            items,
            acceptFilterBoxTextAsSelection: true,
        };

        test('Picker should be displayed with expected items', async () => {
            const state: InterpreterStateArgs = { path: 'some path', workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(expectedParameters))
                .returns(() => Promise.resolve((undefined as unknown) as QuickPickItem))
                .verifiable(TypeMoq.Times.once());

            await setInterpreterCommand._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            multiStepInput.verifyAll();
        });

        test('If user enters path to interpreter in the filter box, get path and update state', async () => {
            const state: InterpreterStateArgs = { path: undefined, workspace: undefined };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput
                .setup((i) => i.showQuickPick(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve('enteredPath'));

            await setInterpreterCommand._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            expect(state.path).to.equal('enteredPath', '');
        });

        test('If `Browse...` is selected, open the file browser to get path and update state', async () => {
            const state: InterpreterStateArgs = { path: undefined, workspace: undefined };
            const expectedPathUri = Uri.parse('browsed path');
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput.setup((i) => i.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve(items[0]));
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
                title: InterpreterQuickPickList.browsePath.title(),
            };
            const multiStepInput = TypeMoq.Mock.ofType<IMultiStepInput<InterpreterStateArgs>>();
            multiStepInput.setup((i) => i.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve(items[0]));
            appShell
                .setup((a) => a.showOpenDialog(expectedParams as OpenDialogOptions))
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
                title: InterpreterQuickPickList.browsePath.title(),
            };
            multiStepInput.setup((i) => i.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve(items[0]));
            appShell.setup((a) => a.showOpenDialog(expectedParams)).verifiable(TypeMoq.Times.once());
            platformService.setup((p) => p.isWindows).returns(() => false);

            await setInterpreterCommand._enterOrBrowseInterpreterPath(multiStepInput.object, state);

            appShell.verifyAll();
        });
    });

    suite('Test method setInterpreter()', async () => {
        test('Update Global settings when there are no workspaces', async () => {
            pythonSettings.setup((p) => p.pythonPath).returns(() => 'python');
            const selectedItem: IInterpreterQuickPickItem = {
                description: '',
                detail: '',
                label: '',
                path: 'This is the selected Python path',

                interpreter: {} as PythonEnvironment,
            };

            workspace.setup((w) => w.workspaceFolders).returns(() => undefined);

            interpreterSelector.setup((i) => i.getSuggestions(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
            const multiStepInput = {
                run: (_: unknown, state: InterpreterStateArgs) => {
                    state.path = selectedItem.path;
                    return Promise.resolve();
                },
            };
            multiStepInputFactory.setup((f) => f.create()).returns(() => multiStepInput as IMultiStepInput<unknown>);
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(selectedItem.path),
                        TypeMoq.It.isValue(ConfigurationTarget.Global),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(undefined),
                    ),
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

                interpreter: {} as PythonEnvironment,
            };

            const folder = { name: 'one', uri: Uri.parse('one'), index: 0 };
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder]);

            interpreterSelector.setup((i) => i.getSuggestions(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));

            const multiStepInput = {
                run: (_: unknown, state: InterpreterStateArgs) => {
                    state.path = selectedItem.path;
                    return Promise.resolve();
                },
            };
            multiStepInputFactory.setup((f) => f.create()).returns(() => multiStepInput as IMultiStepInput<unknown>);

            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(selectedItem.path),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder.uri),
                    ),
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

                interpreter: {} as PythonEnvironment,
            };

            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);
            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri,
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri,
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri,
                },
            ];

            interpreterSelector.setup((i) => i.getSuggestions(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));

            const multiStepInput = {
                run: (_: unknown, state: InterpreterStateArgs) => {
                    state.path = selectedItem.path;
                    return Promise.resolve();
                },
            };
            multiStepInputFactory.setup((f) => f.create()).returns(() => multiStepInput as IMultiStepInput<unknown>);
            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() =>
                    Promise.resolve({
                        label: 'two',
                        description: path.dirname(folder2.uri.fsPath),
                        uri: folder2.uri,
                    }),
                )
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(selectedItem.path),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder2.uri),
                    ),
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

                interpreter: {} as PythonEnvironment,
            };

            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);
            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri,
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri,
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri,
                },
            ];

            interpreterSelector
                .setup((i) => i.getSuggestions(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve([selectedItem]));
            const multiStepInput = {
                run: (_: unknown, state: InterpreterStateArgs) => {
                    state.path = selectedItem.path;
                    return Promise.resolve();
                },
            };
            multiStepInputFactory.setup((f) => f.create()).returns(() => multiStepInput as IMultiStepInput<unknown>);
            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() =>
                    Promise.resolve({
                        label: Interpreters.entireWorkspace(),
                        uri: folder1.uri,
                    }),
                )
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(selectedItem.path),
                        TypeMoq.It.isValue(ConfigurationTarget.Workspace),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder1.uri),
                    ),
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
            multiStepInputFactory.setup((f) => f.create()).verifiable(TypeMoq.Times.never());

            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri,
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri,
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri,
                },
            ];

            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
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
                workspace.object,
                experimentService.object,
            );
            type InputStepType = () => Promise<InputStep<unknown> | void>;
            let inputStep!: InputStepType;
            pythonSettings.setup((p) => p.pythonPath).returns(() => 'python');
            const selectedItem: IInterpreterQuickPickItem = {
                description: '',
                detail: '',
                label: '',
                path: 'This is the selected Python path',

                interpreter: {} as PythonEnvironment,
            };

            workspace.setup((w) => w.workspaceFolders).returns(() => undefined);

            interpreterSelector.setup((i) => i.getSuggestions(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
            const multiStepInput = {
                run: (inputStepArg: InputStepType, state: InterpreterStateArgs) => {
                    inputStep = inputStepArg;
                    state.path = selectedItem.path;
                    return Promise.resolve();
                },
            };
            multiStepInputFactory.setup((f) => f.create()).returns(() => multiStepInput as IMultiStepInput<unknown>);
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(selectedItem.path),
                        TypeMoq.It.isValue(ConfigurationTarget.Global),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(undefined),
                    ),
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
