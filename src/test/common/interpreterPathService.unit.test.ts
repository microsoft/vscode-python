// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import {
    ConfigurationChangeEvent,
    ConfigurationTarget,
    Event,
    EventEmitter,
    Uri,
    WorkspaceConfiguration
} from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import {
    defaultInterpreterPathSetting,
    InterpreterPathService,
    isGlobalSettingCopiedKey,
    workspaceFolderKeysForWhichTheCopyIsDone_Key,
    workspaceKeysForWhichTheCopyIsDone_Key
} from '../../client/common/interpreterPathService';
import { FileSystemPaths } from '../../client/common/platform/fs-paths';
import { InterpreterConfigurationScope, IPersistentState, IPersistentStateFactory } from '../../client/common/types';
import { createDeferred, sleep } from '../../client/common/utils/async';

suite('Interpreter Path Service', async () => {
    let interpreterPathService: InterpreterPathService;
    let persistentStateFactory: TypeMoq.IMock<IPersistentStateFactory>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    const resource = Uri.parse('a');
    const resourceOutsideOfWorkspace = Uri.parse('b');
    const interpreterPath = 'path/to/interpreter';
    const fs = FileSystemPaths.withDefaults();
    setup(() => {
        const event = TypeMoq.Mock.ofType<Event<ConfigurationChangeEvent>>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService
            .setup((w) => w.getWorkspaceFolder(resource))
            .returns(() => ({
                uri: resource,
                name: 'Workspacefolder',
                index: 0
            }));
        workspaceService.setup((w) => w.getWorkspaceFolder(resourceOutsideOfWorkspace)).returns(() => undefined);
        persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        workspaceService.setup((w) => w.onDidChangeConfiguration).returns(() => event.object);
        interpreterPathService = new InterpreterPathService(persistentStateFactory.object, workspaceService.object, []);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Ensure execution of method copyOldInterpreterStorageValuesToNew() goes as expected', async () => {
        const _copyWorkspaceFolderValueToNewStorage = sinon.stub(
            InterpreterPathService.prototype,
            '_copyWorkspaceFolderValueToNewStorage'
        );
        const _copyWorkspaceValueToNewStorage = sinon.stub(
            InterpreterPathService.prototype,
            '_copyWorkspaceValueToNewStorage'
        );
        const _moveGlobalSettingValueToNewStorage = sinon.stub(
            InterpreterPathService.prototype,
            '_moveGlobalSettingValueToNewStorage'
        );
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService.setup((w) => w.getConfiguration('python', resource)).returns(() => workspaceConfig.object);
        workspaceConfig
            .setup((w) => w.inspect<string>('pythonPath'))
            .returns(
                () =>
                    ({
                        globalValue: 'globalPythonPath',
                        workspaceFolderValue: 'workspaceFolderPythonPath',
                        workspaceValue: 'workspacePythonPath'
                        // tslint:disable-next-line: no-any
                    } as any)
            );

        interpreterPathService = new InterpreterPathService(persistentStateFactory.object, workspaceService.object, []);
        await interpreterPathService.copyOldInterpreterStorageValuesToNew(resource);

        assert(_copyWorkspaceFolderValueToNewStorage.calledWith(resource, 'workspaceFolderPythonPath'));
        assert(_copyWorkspaceValueToNewStorage.calledWith(resource, 'workspacePythonPath'));
        assert(_moveGlobalSettingValueToNewStorage.calledWith('globalPythonPath'));
    });

    test('If the one-off transfer to new storage has not happened yet for the workspace folder, do it and record the transfer', async () => {
        const update = sinon.stub(InterpreterPathService.prototype, 'update');
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string[]>>();
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string[]>(workspaceFolderKeysForWhichTheCopyIsDone_Key, []))
            .returns(() => persistentState.object);
        persistentState.setup((p) => p.value).returns(() => ['...storedWorkspaceFolderKeys']);
        persistentState
            .setup((p) => p.updateValue([resource.fsPath, '...storedWorkspaceFolderKeys']))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        interpreterPathService = new InterpreterPathService(persistentStateFactory.object, workspaceService.object, []);
        await interpreterPathService._copyWorkspaceFolderValueToNewStorage(resource, 'workspaceFolderPythonPath');

        assert(update.calledWith(resource, ConfigurationTarget.WorkspaceFolder, 'workspaceFolderPythonPath'));
        persistentState.verifyAll();
    });

    test('If the one-off transfer to new storage has already happened for the workspace folder, do not update and simply return', async () => {
        const update = sinon.stub(InterpreterPathService.prototype, 'update');
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string[]>>();
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string[]>(workspaceFolderKeysForWhichTheCopyIsDone_Key, []))
            .returns(() => persistentState.object);
        persistentState.setup((p) => p.value).returns(() => [resource.fsPath, '...storedWorkspaceKeys']);
        persistentState.setup((p) => p.updateValue(TypeMoq.It.isAny())).verifiable(TypeMoq.Times.never());

        interpreterPathService = new InterpreterPathService(persistentStateFactory.object, workspaceService.object, []);
        await interpreterPathService._copyWorkspaceFolderValueToNewStorage(resource, 'workspaceFolderPythonPath');

        assert(update.notCalled);
        persistentState.verifyAll();
    });

    test('If the one-off transfer to new storage has not happened yet for the workspace, do it and record the transfer', async () => {
        const workspaceFileUri = Uri.parse('path/to/workspaceFile');
        const expectedWorkspaceKey = fs.normCase(workspaceFileUri.fsPath);
        const update = sinon.stub(InterpreterPathService.prototype, 'update');
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string[]>>();
        workspaceService.setup((w) => w.workspaceFile).returns(() => workspaceFileUri);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string[]>(workspaceKeysForWhichTheCopyIsDone_Key, []))
            .returns(() => persistentState.object);
        persistentState.setup((p) => p.value).returns(() => ['...storedWorkspaceKeys']);
        persistentState
            .setup((p) => p.updateValue([expectedWorkspaceKey, '...storedWorkspaceKeys']))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        interpreterPathService = new InterpreterPathService(persistentStateFactory.object, workspaceService.object, []);
        await interpreterPathService._copyWorkspaceValueToNewStorage(resource, 'workspacePythonPath');

        assert(update.calledWith(resource, ConfigurationTarget.Workspace, 'workspacePythonPath'));
        persistentState.verifyAll();
    });

    test('If the one-off transfer to new storage has already happened for the workspace, do not update and simply return', async () => {
        const workspaceFileUri = Uri.parse('path/to/workspaceFile');
        const expectedWorkspaceKey = fs.normCase(workspaceFileUri.fsPath);
        const update = sinon.stub(InterpreterPathService.prototype, 'update');
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string[]>>();
        workspaceService.setup((w) => w.workspaceFile).returns(() => workspaceFileUri);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string[]>(workspaceKeysForWhichTheCopyIsDone_Key, []))
            .returns(() => persistentState.object);
        persistentState.setup((p) => p.value).returns(() => [expectedWorkspaceKey, '...storedWorkspaceKeys']);
        persistentState.setup((p) => p.updateValue(TypeMoq.It.isAny())).verifiable(TypeMoq.Times.never());

        interpreterPathService = new InterpreterPathService(persistentStateFactory.object, workspaceService.object, []);
        await interpreterPathService._copyWorkspaceValueToNewStorage(resource, 'workspacePythonPath');

        assert(update.notCalled);
        persistentState.verifyAll();
    });

    test('Do not update workspace settings and if a folder is directly opened', async () => {
        const update = sinon.stub(InterpreterPathService.prototype, 'update');
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string[]>>();
        workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string[]>(workspaceKeysForWhichTheCopyIsDone_Key, []))
            .returns(() => persistentState.object);
        persistentState.setup((p) => p.value).verifiable(TypeMoq.Times.never());
        persistentState.setup((p) => p.updateValue(TypeMoq.It.isAny())).verifiable(TypeMoq.Times.never());

        interpreterPathService = new InterpreterPathService(persistentStateFactory.object, workspaceService.object, []);
        await interpreterPathService._copyWorkspaceValueToNewStorage(resource, 'workspacePythonPath');

        assert(update.notCalled);
        persistentState.verifyAll();
    });

    test('If the one-off transfer to new storage has not happened yet for the user setting, do it, record the transfer and remove the original user setting', async () => {
        const update = sinon.stub(InterpreterPathService.prototype, 'update');
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<boolean>(isGlobalSettingCopiedKey, false))
            .returns(() => persistentState.object);
        persistentState.setup((p) => p.value).returns(() => false);
        persistentState.setup((p) => p.updateValue(true)).verifiable(TypeMoq.Times.once());
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService.setup((w) => w.getConfiguration('python')).returns(() => workspaceConfig.object);
        workspaceConfig
            .setup((w) => w.update('pythonPath', undefined, ConfigurationTarget.Global))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        interpreterPathService = new InterpreterPathService(persistentStateFactory.object, workspaceService.object, []);
        await interpreterPathService._moveGlobalSettingValueToNewStorage('globalPythonPath');

        assert(update.calledWith(undefined, ConfigurationTarget.Global, 'globalPythonPath'));
        persistentState.verifyAll();
        workspaceConfig.verifyAll();
    });

    test('If the one-off transfer to new storage has already happened for the user setting, do not update and simply return', async () => {
        const update = sinon.stub(InterpreterPathService.prototype, 'update');
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<boolean>(isGlobalSettingCopiedKey, false))
            .returns(() => persistentState.object);
        persistentState.setup((p) => p.value).returns(() => true);
        persistentState.setup((p) => p.updateValue(TypeMoq.It.isAny())).verifiable(TypeMoq.Times.never());

        interpreterPathService = new InterpreterPathService(persistentStateFactory.object, workspaceService.object, []);
        await interpreterPathService._moveGlobalSettingValueToNewStorage('globalPythonPath');

        assert(update.notCalled);
        persistentState.verifyAll();
    });

    test('Global settings are not updated if stored value is same as new value', async () => {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService.setup((w) => w.getConfiguration('python')).returns(() => workspaceConfig.object);
        workspaceConfig
            .setup((w) => w.inspect<string>('defaultInterpreterPath'))
            .returns(
                () =>
                    ({
                        globalValue: interpreterPath
                        // tslint:disable-next-line: no-any
                    } as any)
            );
        workspaceConfig
            .setup((w) => w.update('defaultInterpreterPath', interpreterPath, true))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        await interpreterPathService.update(resource, ConfigurationTarget.Global, interpreterPath);

        workspaceConfig.verifyAll();
    });

    test('Global settings are correctly updated otherwise', async () => {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService.setup((w) => w.getConfiguration('python')).returns(() => workspaceConfig.object);
        workspaceConfig
            .setup((w) => w.inspect<string>('defaultInterpreterPath'))
            .returns(
                () =>
                    ({
                        globalValue: 'storedValue'
                        // tslint:disable-next-line: no-any
                    } as any)
            );
        workspaceConfig
            .setup((w) => w.update('defaultInterpreterPath', interpreterPath, true))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await interpreterPathService.update(resource, ConfigurationTarget.Global, interpreterPath);

        workspaceConfig.verifyAll();
    });

    test('Workspace settings are not updated if stored value is same as new value', async () => {
        const expectedSettingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => persistentState.object)
            .verifiable(TypeMoq.Times.once());
        persistentState.setup((p) => p.value).returns(() => interpreterPath);
        persistentState
            .setup((p) => p.updateValue(interpreterPath))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        await interpreterPathService.update(resource, ConfigurationTarget.Workspace, interpreterPath);

        persistentState.verifyAll();
        persistentStateFactory.verifyAll();
    });

    test('Workspace settings are correctly updated if a folder is directly opened', async () => {
        const expectedSettingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => persistentState.object)
            .verifiable(TypeMoq.Times.once());
        persistentState
            .setup((p) => p.updateValue(interpreterPath))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await interpreterPathService.update(resource, ConfigurationTarget.Workspace, interpreterPath);

        persistentState.verifyAll();
        persistentStateFactory.verifyAll();
    });

    test('Ensure the correct event is fired if Workspace settings are updated', async () => {
        const expectedSettingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => persistentState.object);
        persistentState.setup((p) => p.updateValue(interpreterPath)).returns(() => Promise.resolve());

        const _didChangeInterpreterEmitter = TypeMoq.Mock.ofType<EventEmitter<InterpreterConfigurationScope>>();
        interpreterPathService._didChangeInterpreterEmitter = _didChangeInterpreterEmitter.object;
        _didChangeInterpreterEmitter
            .setup((emitter) => emitter.fire({ uri: resource, configTarget: ConfigurationTarget.Workspace }))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());

        await interpreterPathService.update(resource, ConfigurationTarget.Workspace, interpreterPath);

        _didChangeInterpreterEmitter.verifyAll();
    });

    test('Workspace settings are correctly updated in case of multiroot folders', async () => {
        const workspaceFileUri = Uri.parse('path/to/workspaceFile');
        const expectedSettingKey = `WORKSPACE_INTERPRETER_PATH_${fs.normCase(workspaceFileUri.fsPath)}`;
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        workspaceService.setup((w) => w.workspaceFile).returns(() => workspaceFileUri);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => persistentState.object)
            .verifiable(TypeMoq.Times.once());
        persistentState
            .setup((p) => p.updateValue(interpreterPath))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await interpreterPathService.update(resource, ConfigurationTarget.Workspace, interpreterPath);

        persistentState.verifyAll();
        persistentStateFactory.verifyAll();
    });

    test('Workspace folder settings are correctly updated in case of multiroot folders', async () => {
        const expectedSettingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => persistentState.object)
            .verifiable(TypeMoq.Times.once());
        persistentState
            .setup((p) => p.updateValue(interpreterPath))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await interpreterPathService.update(resource, ConfigurationTarget.WorkspaceFolder, interpreterPath);

        persistentState.verifyAll();
        persistentStateFactory.verifyAll();
    });

    test('Ensure the correct event is fired if Workspace folder settings are updated', async () => {
        const expectedSettingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => persistentState.object)
            .verifiable(TypeMoq.Times.once());
        persistentState
            .setup((p) => p.updateValue(interpreterPath))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        const _didChangeInterpreterEmitter = TypeMoq.Mock.ofType<EventEmitter<InterpreterConfigurationScope>>();
        interpreterPathService._didChangeInterpreterEmitter = _didChangeInterpreterEmitter.object;
        _didChangeInterpreterEmitter
            .setup((emitter) => emitter.fire({ uri: resource, configTarget: ConfigurationTarget.WorkspaceFolder }))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());

        await interpreterPathService.update(resource, ConfigurationTarget.WorkspaceFolder, interpreterPath);

        _didChangeInterpreterEmitter.verifyAll();
    });

    test('Updating workspace settings throws error if no workspace is opened', async () => {
        const expectedSettingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.workspaceFolders).returns(() => undefined);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => persistentState.object)
            .verifiable(TypeMoq.Times.never());
        persistentState
            .setup((p) => p.updateValue(interpreterPath))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        const promise = interpreterPathService.update(
            resourceOutsideOfWorkspace,
            ConfigurationTarget.Workspace,
            interpreterPath
        );
        await expect(promise).to.eventually.be.rejectedWith(Error);

        persistentState.verifyAll();
        persistentStateFactory.verifyAll();
    });

    test('Updating workspace folder settings throws error if no workspace is opened', async () => {
        const expectedSettingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.workspaceFolders).returns(() => undefined);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => persistentState.object)
            .verifiable(TypeMoq.Times.never());
        persistentState
            .setup((p) => p.updateValue(interpreterPath))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        const promise = interpreterPathService.update(
            resourceOutsideOfWorkspace,
            ConfigurationTarget.Workspace,
            interpreterPath
        );
        await expect(promise).to.eventually.be.rejectedWith(Error);

        persistentState.verifyAll();
        persistentStateFactory.verifyAll();
    });

    test('Inspecting settings returns as expected if no workspace is opened', async () => {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService.setup((w) => w.getConfiguration('python')).returns(() => workspaceConfig.object);
        workspaceConfig
            .setup((w) => w.inspect<string>('defaultInterpreterPath'))
            .returns(
                () =>
                    ({
                        globalValue: 'default/path/to/interpreter'
                        // tslint:disable-next-line: no-any
                    } as any)
            );
        const persistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.workspaceFolders).returns(() => undefined);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => persistentState.object)
            .verifiable(TypeMoq.Times.never());

        const settings = interpreterPathService.inspect(resourceOutsideOfWorkspace);
        assert.deepEqual(settings, {
            globalValue: 'default/path/to/interpreter',
            workspaceFolderValue: undefined,
            workspaceValue: undefined
        });

        persistentStateFactory.verifyAll();
    });

    test('Inspecting settings returns as expected if a folder is directly opened', async () => {
        const expectedSettingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        // No workspace file is present if a folder is directly opened
        workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        workspaceService.setup((w) => w.getConfiguration('python')).returns(() => workspaceConfig.object);
        workspaceConfig
            .setup((w) => w.inspect<string>('defaultInterpreterPath'))
            .returns(
                () =>
                    ({
                        globalValue: 'default/path/to/interpreter'
                        // tslint:disable-next-line: no-any
                    } as any)
            );
        const workspaceFolderPersistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.workspaceFolders).returns(() => undefined);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => workspaceFolderPersistentState.object);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedSettingKey, undefined))
            .returns(() => workspaceFolderPersistentState.object);
        workspaceFolderPersistentState.setup((p) => p.value).returns(() => 'workspaceFolderValue');

        const settings = interpreterPathService.inspect(resource);

        assert.deepEqual(settings, {
            globalValue: 'default/path/to/interpreter',
            workspaceFolderValue: 'workspaceFolderValue',
            workspaceValue: 'workspaceFolderValue'
        });
    });

    test('Inspecting settings returns as expected in case of multiroot folders', async () => {
        const workspaceFileUri = Uri.parse('path/to/workspaceFile');
        const expectedWorkspaceSettingKey = `WORKSPACE_INTERPRETER_PATH_${fs.normCase(workspaceFileUri.fsPath)}`;
        const expectedWorkspaceFolderSettingKey = `WORKSPACE_FOLDER_INTERPRETER_PATH_${resource.fsPath}`;
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        // A workspace file is present in case of multiroot workspace folders
        workspaceService.setup((w) => w.workspaceFile).returns(() => workspaceFileUri);
        workspaceService.setup((w) => w.getWorkspaceFolderIdentifier(resource)).returns(() => resource.fsPath);
        workspaceService.setup((w) => w.getConfiguration('python')).returns(() => workspaceConfig.object);
        workspaceConfig
            .setup((w) => w.inspect<string>('defaultInterpreterPath'))
            .returns(
                () =>
                    ({
                        globalValue: 'default/path/to/interpreter'
                        // tslint:disable-next-line: no-any
                    } as any)
            );
        const workspaceFolderPersistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        const workspacePersistentState = TypeMoq.Mock.ofType<IPersistentState<string | undefined>>();
        workspaceService.setup((w) => w.workspaceFolders).returns(() => undefined);
        persistentStateFactory
            .setup((p) =>
                p.createGlobalPersistentState<string | undefined>(expectedWorkspaceFolderSettingKey, undefined)
            )
            .returns(() => workspaceFolderPersistentState.object);
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState<string | undefined>(expectedWorkspaceSettingKey, undefined))
            .returns(() => workspacePersistentState.object);
        workspaceFolderPersistentState.setup((p) => p.value).returns(() => 'workspaceFolderValue');
        workspacePersistentState.setup((p) => p.value).returns(() => 'workspaceValue');

        const settings = interpreterPathService.inspect(resource);

        assert.deepEqual(settings, {
            globalValue: 'default/path/to/interpreter',
            workspaceFolderValue: 'workspaceFolderValue',
            workspaceValue: 'workspaceValue'
        });
    });

    test(`Getting setting value returns workspace folder value if it's defined`, async () => {
        interpreterPathService.inspect = () => ({
            globalValue: 'default/path/to/interpreter',
            workspaceFolderValue: 'workspaceFolderValue',
            workspaceValue: 'workspaceValue'
        });
        const settingValue = interpreterPathService.get(resource);
        expect(settingValue).to.equal('workspaceFolderValue');
    });

    test(`Getting setting value returns workspace value if workspace folder value is 'undefined'`, async () => {
        interpreterPathService.inspect = () => ({
            globalValue: 'default/path/to/interpreter',
            workspaceFolderValue: undefined,
            workspaceValue: 'workspaceValue'
        });
        const settingValue = interpreterPathService.get(resource);
        expect(settingValue).to.equal('workspaceValue');
    });

    test(`Getting setting value returns workspace value if workspace folder value is 'undefined'`, async () => {
        interpreterPathService.inspect = () => ({
            globalValue: 'default/path/to/interpreter',
            workspaceFolderValue: undefined,
            workspaceValue: 'workspaceValue'
        });
        const settingValue = interpreterPathService.get(resource);
        expect(settingValue).to.equal('workspaceValue');
    });

    test(`Getting setting value returns global value if workspace folder & workspace value are 'undefined'`, async () => {
        interpreterPathService.inspect = () => ({
            globalValue: 'default/path/to/interpreter',
            workspaceFolderValue: undefined,
            workspaceValue: undefined
        });
        const settingValue = interpreterPathService.get(resource);
        expect(settingValue).to.equal('default/path/to/interpreter');
    });

    test(`Getting setting value returns 'python' if all workspace folder, workspace, and global value are 'undefined'`, async () => {
        interpreterPathService.inspect = () => ({
            globalValue: undefined,
            workspaceFolderValue: undefined,
            workspaceValue: undefined
        });
        const settingValue = interpreterPathService.get(resource);
        expect(settingValue).to.equal('python');
    });

    test('If defaultInterpreterPathSetting is changed, an event is fired', async () => {
        const _didChangeInterpreterEmitter = TypeMoq.Mock.ofType<EventEmitter<InterpreterConfigurationScope>>();
        const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
        event
            .setup((e) => e.affectsConfiguration(`python.${defaultInterpreterPathSetting}`))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        interpreterPathService._didChangeInterpreterEmitter = _didChangeInterpreterEmitter.object;
        _didChangeInterpreterEmitter
            .setup((emitter) => emitter.fire({ uri: undefined, configTarget: ConfigurationTarget.Global }))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        await interpreterPathService.onDidChangeConfiguration(event.object);
        _didChangeInterpreterEmitter.verifyAll();
        event.verifyAll();
    });

    test('If some other setting changed, no event is fired', async () => {
        const _didChangeInterpreterEmitter = TypeMoq.Mock.ofType<EventEmitter<InterpreterConfigurationScope>>();
        const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
        event
            .setup((e) => e.affectsConfiguration(`python.${defaultInterpreterPathSetting}`))
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        interpreterPathService._didChangeInterpreterEmitter = _didChangeInterpreterEmitter.object;
        _didChangeInterpreterEmitter
            .setup((emitter) => emitter.fire(TypeMoq.It.isAny()))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.never());
        await interpreterPathService.onDidChangeConfiguration(event.object);
        _didChangeInterpreterEmitter.verifyAll();
        event.verifyAll();
    });

    test('Ensure on interpreter change captures the fired event with the correct arguments', async () => {
        const deferred = createDeferred<true>();
        const interpreterConfigurationScope = { uri: undefined, configTarget: ConfigurationTarget.Global };
        interpreterPathService.onDidChange((i) => {
            expect(i).to.equal(interpreterConfigurationScope);
            deferred.resolve(true);
        });
        interpreterPathService._didChangeInterpreterEmitter.fire(interpreterConfigurationScope);
        const eventCaptured = await Promise.race([deferred.promise, sleep(1000).then(() => false)]);
        expect(eventCaptured).to.equal(true, 'Event should be captured');
    });
});
