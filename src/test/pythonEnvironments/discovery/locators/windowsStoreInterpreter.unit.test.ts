// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { PythonExecutionFactory } from '../../../../client/common/process/pythonExecutionFactory';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../../../client/common/process/types';
import { IPersistentStateFactory } from '../../../../client/common/types';
import { ServiceContainer } from '../../../../client/ioc/container';
import { IServiceContainer } from '../../../../client/ioc/types';
import { WindowsStoreInterpreter } from '../../../../client/pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';

// We use this for mocking.
class ComponentAdapter {
    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
    public async isWindowsStoreInterpreter(_pythonPath: string): Promise<boolean | undefined> {
        return undefined;
    }
}

suite('Interpreters - Windows Store Interpreter', () => {
    let windowsStoreInterpreter: WindowsStoreInterpreter;
    let pyenvs: ComponentAdapter;
    let fs: IFileSystem;
    let persistanceStateFactory: IPersistentStateFactory;
    let executionFactory: IPythonExecutionFactory;
    let serviceContainer: IServiceContainer;
    setup(() => {
        pyenvs = mock(ComponentAdapter);
        fs = mock(FileSystem);
        persistanceStateFactory = mock(PersistentStateFactory);
        executionFactory = mock(PythonExecutionFactory);
        serviceContainer = mock(ServiceContainer);
        when(serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory)).thenReturn(
            instance(executionFactory),
        );
        when(pyenvs.isWindowsStoreInterpreter(anything())).thenReturn(Promise.resolve(undefined));
        windowsStoreInterpreter = new WindowsStoreInterpreter(
            instance(serviceContainer),
            instance(persistanceStateFactory),
            instance(fs),
            instance(pyenvs),
        );
    });
    const windowsStoreInterpreters = [
        '\\\\Program Files\\WindowsApps\\Something\\Python.exe',
        '..\\Program Files\\WindowsApps\\Something\\Python.exe',
        '..\\one\\Program Files\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Files\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Files\\WindowsApps\\Python.exe',
        'C:\\Microsoft\\WindowsApps\\Something\\Python.exe',
        'C:\\Microsoft\\WindowsApps\\Python.exe',
        'C:\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
        'C:\\microsoft\\WindowsApps\\PythonSoftwareFoundation\\Something\\Python.exe',
    ];

    async function isWindowsStoreInterpreter(interpreter: string) {
        return windowsStoreInterpreter.isWindowsStoreInterpreter(interpreter);
    }

    function isHiddenInterpreter(interpreter: string) {
        return windowsStoreInterpreter.isHiddenInterpreter(interpreter);
    }

    for (const interpreter of windowsStoreInterpreters) {
        test(`${interpreter} must be identified as a Windows Store interpreter`, async () => {
            expect(await isWindowsStoreInterpreter(interpreter)).to.equal(true, 'Must be true');
        });

        test(`${interpreter.toLowerCase()} must be identified as a Windows Store interpreter (lower case)`, async () => {
            expect(await isWindowsStoreInterpreter(interpreter.toLowerCase())).to.equal(true, 'Must be true');
            expect(await isWindowsStoreInterpreter(interpreter.toUpperCase())).to.equal(true, 'Must be true');
        });

        const otherDrive = `D${interpreter.substring(1)}`;
        test(`${otherDrive} must be identified as a Windows Store interpreter (ignoring driver letter)`, async () => {
            expect(await isWindowsStoreInterpreter(otherDrive)).to.equal(true, 'Must be true');
        });

        const ignorePathSeparator = interpreter.replace(/\\/g, '/');
        test(`${ignorePathSeparator} must be identified as a Windows Store interpreter (ignoring path separator)`, async () => {
            expect(await isWindowsStoreInterpreter(ignorePathSeparator)).to.equal(true, 'Must be true');
        });
    }

    const nonWindowsStoreInterpreters = [
        '..\\Program Filess\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Filess\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Files\\WindowsAppss\\Python.exe',
        'C:\\Microsofts\\WindowsApps\\Something\\Python.exe',
        'C:\\Microsoft\\WindowsAppss\\Python.exe',
        'C:\\Microsofts\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
        'C:\\microsoft\\WindowsAppss\\PythonSoftwareFoundation\\Something\\Python.exe',
        'C:\\Python\\python.exe',
        'C:\\Program Files\\Python\\python.exe',
        'C:\\Program Files\\Microsoft\\Python\\python.exe',
        '..\\apps\\Python.exe',
        'C:\\Apps\\Python.exe',
    ];
    for (const interpreter of nonWindowsStoreInterpreters) {
        test(`${interpreter} must not be identified as a Windows Store interpreter`, async () => {
            const ignorePathSeparator = interpreter.replace(/\\/g, '/');

            expect(isHiddenInterpreter(interpreter)).to.equal(false, 'Must be false');
            expect(isHiddenInterpreter(ignorePathSeparator)).to.equal(false, 'Must be false');

            expect(await isWindowsStoreInterpreter(interpreter)).to.equal(false, 'Must be false');
            expect(await isWindowsStoreInterpreter(ignorePathSeparator)).to.equal(false, 'Must be false');

            expect(isHiddenInterpreter(interpreter.toLowerCase())).to.equal(false, 'Must be false');
            expect(await isWindowsStoreInterpreter(interpreter.toUpperCase())).to.equal(false, 'Must be false');
            expect(await isWindowsStoreInterpreter(`D${interpreter.substring(1)}`)).to.equal(false, 'Must be false');
        });
    }
    const windowsStoreHiddenInterpreters = [
        'C:\\Program Files\\WindowsApps\\Something\\Python.exe',
        'C:\\Program Files\\WindowsApps\\Python.exe',
        'C:\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
        'C:\\microsoft\\WindowsApps\\PythonSoftwareFoundation\\Something\\Python.exe',
    ];
    for (const interpreter of windowsStoreHiddenInterpreters) {
        test(`${interpreter} must be identified as a Windows Store (hidden) interpreter`, () => {
            expect(isHiddenInterpreter(interpreter)).to.equal(true, 'Must be true');
        });

        test(`${interpreter.toLowerCase()} must be identified as a Windows Store (hidden) interpreter (ignoring case)`, () => {
            expect(isHiddenInterpreter(interpreter.toLowerCase())).to.equal(true, 'Must be true');
            expect(isHiddenInterpreter(interpreter.toUpperCase())).to.equal(true, 'Must be true');
        });

        const otherDrive = `D${interpreter.substring(1)}`;
        test(`${otherDrive} must be identified as a Windows Store (hidden) interpreter (ignoring driver letter)`, () => {
            expect(isHiddenInterpreter(otherDrive)).to.equal(true, 'Must be true');
        });
    }
    const nonWindowsStoreHiddenInterpreters = [
        'C:\\Microsofts\\WindowsApps\\Something\\Python.exe',
        'C:\\Microsoft\\WindowsAppss\\Python.exe',
    ];
    for (const interpreter of nonWindowsStoreHiddenInterpreters) {
        test(`${interpreter} must not be identified as a Windows Store (hidden) interpreter`, () => {
            expect(isHiddenInterpreter(interpreter)).to.equal(false, 'Must be true');
        });
    }

    test('Getting hash should get hash of python executable', async () => {
        const pythonPath = 'WindowsInterpreterPath';

        const stateStore = mock<PersistentState<string | undefined>>(PersistentState);
        const key = `WINDOWS_STORE_INTERPRETER_HASH_${pythonPath}`;
        const pythonService = mock<IPythonExecutionService>();
        const pythonServiceInstance = instance(pythonService);
        (pythonServiceInstance as any).then = undefined;
        const oneHour = 60 * 60 * 1000;

        when(
            persistanceStateFactory.createGlobalPersistentState<string | undefined>(key, undefined, oneHour),
        ).thenReturn(instance(stateStore));
        when(stateStore.value).thenReturn();
        when(executionFactory.create(deepEqual({ pythonPath }))).thenResolve(pythonServiceInstance);
        when(pythonService.getExecutablePath()).thenResolve('FullyQualifiedPathToPythonExec');
        when(fs.getFileHash('FullyQualifiedPathToPythonExec')).thenResolve('hash');
        when(stateStore.updateValue('hash')).thenResolve();

        const hash = await windowsStoreInterpreter.getInterpreterHash(pythonPath);

        verify(persistanceStateFactory.createGlobalPersistentState(key, undefined, oneHour)).once();
        verify(stateStore.value).once();
        verify(executionFactory.create(deepEqual({ pythonPath }))).once();
        verify(pythonService.getExecutablePath()).once();
        verify(fs.getFileHash('FullyQualifiedPathToPythonExec')).once();
        verify(stateStore.updateValue('hash')).once();
        expect(hash).to.equal('hash');
    });

    test('Getting hash from cache', async () => {
        const pythonPath = 'WindowsInterpreterPath';

        const stateStore = mock<PersistentState<string | undefined>>(PersistentState);
        const key = `WINDOWS_STORE_INTERPRETER_HASH_${pythonPath}`;
        const oneHour = 60 * 60 * 1000;

        when(
            persistanceStateFactory.createGlobalPersistentState<string | undefined>(key, undefined, oneHour),
        ).thenReturn(instance(stateStore));
        when(stateStore.value).thenReturn('fileHash');
        const hash = await windowsStoreInterpreter.getInterpreterHash(pythonPath);

        verify(persistanceStateFactory.createGlobalPersistentState(key, undefined, oneHour)).once();
        verify(stateStore.value).atLeast(1);
        verify(executionFactory.create(anything())).never();
        verify(fs.getFileHash(anything())).never();
        verify(stateStore.updateValue(anything())).never();
        expect(hash).to.equal('fileHash');
    });
});
