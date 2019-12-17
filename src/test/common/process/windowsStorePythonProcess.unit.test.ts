// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { ProcessLogger } from '../../../client/common/process/logger';
import { ProcessService } from '../../../client/common/process/proc';
import { IProcessLogger, IProcessService } from '../../../client/common/process/types';
import { WindowsStorePythonProcess } from '../../../client/common/process/windowsStorePythonProcess';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { WindowsStoreInterpreter } from '../../../client/interpreter/locators/services/windowsStoreInterpreter';
import { IWindowsStoreInterpreter } from '../../../client/interpreter/locators/types';
import { ServiceContainer } from '../../../client/ioc/container';

suite('Windows store execution service', () => {
    const pythonPath = 'foo';
    let fileSystem: IFileSystem;
    let processLogger: IProcessLogger;
    let processService: IProcessService;
    let windowsStoreInterpreter: IWindowsStoreInterpreter;
    let interpreterService: IInterpreterService;

    let executionService: WindowsStorePythonProcess;

    setup(() => {
        fileSystem = mock(FileSystem);
        when(fileSystem.fileExists(anything())).thenResolve(true);

        processLogger = mock(ProcessLogger);
        processService = mock(ProcessService);
        windowsStoreInterpreter = mock(WindowsStoreInterpreter);
        interpreterService = mock(InterpreterService);

        const serviceContainer = mock(ServiceContainer);
        when(serviceContainer.get<IProcessLogger>(IProcessLogger)).thenReturn(processLogger);
        when(serviceContainer.get<IInterpreterService>(IInterpreterService)).thenReturn(instance(interpreterService));
        when(serviceContainer.get<IFileSystem>(IFileSystem)).thenReturn(instance(fileSystem));

        executionService = new WindowsStorePythonProcess(instance(serviceContainer), instance(processService), pythonPath, instance(windowsStoreInterpreter));
    });

    test('Should return pythonPath if it is the path to the windows store interpreter', async () => {
        when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenReturn(true);

        const executablePath = await executionService.getExecutablePath();

        assert.deepEqual(executablePath, pythonPath);
        verify(fileSystem.fileExists(anything())).never();
    });

    test('Should call super.getExecutablePath() if it is not the path to the windows store interpreter', async () => {
        when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenReturn(false);

        const executablePath = await executionService.getExecutablePath();

        assert.deepEqual(executablePath, pythonPath);
        verify(fileSystem.fileExists(anything())).once();
    });
});
