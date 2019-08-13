// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length

import { expect } from 'chai';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { PersistentState, PersistentStateFactory } from '../../../client/common/persistentState';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import { IPythonExecutionFactory } from '../../../client/common/process/types';
import { IPersistentStateFactory } from '../../../client/common/types';
import { WindowsStoreInterpreter } from '../../../client/interpreter/locators/services/windowsStoreInterpreter';

suite('Interpreters - Windows Store Interpreter', () => {
    let windowsStoreInterpreter: WindowsStoreInterpreter;
    let fs: IFileSystem;
    let persistanceStateFactory: IPersistentStateFactory;
    let executionFactory: IPythonExecutionFactory;
    setup(() => {
        fs = mock(FileSystem);
        persistanceStateFactory = mock(PersistentStateFactory);
        executionFactory = mock(PythonExecutionFactory);
        windowsStoreInterpreter = new WindowsStoreInterpreter(instance(executionFactory), instance(persistanceStateFactory), instance(fs));
    });
    const interpreters = [
        {
            path: 'C:\\Program Files\\WindowsApps\\Something\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'C:\\Program Files\\WindowsApps\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'C:\\Program Files\\python\\Python.exe',
            isWindowsStoreInterpreter: false,
            isInternalInterpreter: false
        },
        {
            path: 'D:\\program files\\WindowsApps\\Something\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'D:\\program files\\WindowsApps\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'D:\\program files\\python\\Python.exe',
            isWindowsStoreInterpreter: false,
            isInternalInterpreter: false
        },
        {
            path: 'C:\\Program Files\\python\\Python.exe',
            isWindowsStoreInterpreter: false,
            isInternalInterpreter: false
        },
        {
            path: 'C:\\Microsoft\\WindowsApps\\Something\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: false
        },
        {
            path: 'C:\\Microsoft\\WindowsApps\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: false
        },
        {
            path: 'C:\\Microsoft\\python\\Python.exe',
            isWindowsStoreInterpreter: false,
            isInternalInterpreter: false
        },
        {
            path: 'D:\\microsoft\\WindowsApps\\Something\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: false
        },
        {
            path: 'D:\\microsoft\\WindowsApps\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: false
        },
        {
            path: 'D:\\microsoft\\python\\Python.exe',
            isWindowsStoreInterpreter: false,
            isInternalInterpreter: false
        },
        {
            path: 'C:\\Microsoft\\python\\Python.exe',
            isWindowsStoreInterpreter: false,
            isInternalInterpreter: false
        },
        {
            path: 'C:\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'C:\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'C:\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'D:\\microsoft\\WindowsApps\\PythonSoftwareFoundation\\Something\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'D:\\microsoft\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'D:\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\python\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        },
        {
            path: 'C:\\Microsoft\\WindowsApps\\PythonSoftwareFoundation\\Python.exe',
            isWindowsStoreInterpreter: true,
            isInternalInterpreter: true
        }
    ];
    for (const interpreter of interpreters) {
        test(`${interpreter.path} must ${interpreter.isWindowsStoreInterpreter ? 'be' : 'not be'} identified as a windows store interpter`, async () => {
            const isWindowsStoreInterpreter = windowsStoreInterpreter.isWindowsStoreInterpreter(interpreter.path);
            expect(isWindowsStoreInterpreter).to.equal(interpreter.isWindowsStoreInterpreter);
        });
        test(`${interpreter.path} must ${interpreter.isInternalInterpreter ? 'be' : 'not be'} identified as an internal windows store interpter`, async () => {
            const isWindowsStoreInterpreter = await windowsStoreInterpreter.isInternalInterpreter(interpreter.path);
            expect(isWindowsStoreInterpreter).to.equal(interpreter.isInternalInterpreter);
        });
    }

    test('Getting hash should get hash of python executable', async () => {
        const pythonPath = 'WindowsInterpreterPath';

        const stateStore = mock<PersistentState<string | undefined>>(PersistentState);
        const key = `WINDOWS_STORE_INTERPRETER_HASH_${pythonPath}`;
        const pythonService = mock(PythonExecutionService);
        const pythonServiceInstance = instance(pythonService);
        (pythonServiceInstance as any).then = undefined;
        const oneHour = 60 * 60 * 1000;

        when(persistanceStateFactory.createGlobalPersistentState<string | undefined>(key, undefined, oneHour)).thenReturn(instance(stateStore));
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

        when(persistanceStateFactory.createGlobalPersistentState<string | undefined>(key, undefined, oneHour)).thenReturn(instance(stateStore));
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
