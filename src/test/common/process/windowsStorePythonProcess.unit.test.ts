// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { instance, mock, when } from 'ts-mockito';
import { ProcessService } from '../../../client/common/process/proc';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import { IProcessService } from '../../../client/common/process/types';
import { WindowsStorePythonProcess } from '../../../client/common/process/windowsStorePythonProcess';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { WindowsStoreInterpreter } from '../../../client/interpreter/locators/services/windowsStoreInterpreter';
import { IWindowsStoreInterpreter } from '../../../client/interpreter/locators/types';
import { ServiceContainer } from '../../../client/ioc/container';

suite('Windows store execution service', () => {
    const pythonPath = 'foo';
    const superPythonPath = 'bar';

    let processService: IProcessService;
    let windowsStoreInterpreter: IWindowsStoreInterpreter;
    let interpreterService: IInterpreterService;

    let superExecutablePathStub: sinon.SinonStub<[], Promise<string>>;
    let executionService: WindowsStorePythonProcess;

    setup(() => {
        processService = mock(ProcessService);
        windowsStoreInterpreter = mock(WindowsStoreInterpreter);
        interpreterService = mock(InterpreterService);

        const serviceContainer = mock(ServiceContainer);
        when(serviceContainer.get<IInterpreterService>(IInterpreterService)).thenReturn(instance(interpreterService));

        superExecutablePathStub = sinon.stub(PythonExecutionService.prototype, 'getExecutablePath');
        superExecutablePathStub.resolves(superPythonPath);

        executionService = new WindowsStorePythonProcess(instance(serviceContainer), instance(processService), pythonPath, instance(windowsStoreInterpreter));
    });

    teardown(() => {
        sinon.restore();
    });

    test('Should return pythonPath if it is the path to the windows store interpreter', async () => {
        when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenReturn(true);

        const executablePath = await executionService.getExecutablePath();

        assert.deepEqual(executablePath, pythonPath);
        sinon.assert.notCalled(superExecutablePathStub);
    });

    test('Should call super.getExecutablePath() if it is not the path to the windows store interpreter', async () => {
        when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenReturn(false);

        const executablePath = await executionService.getExecutablePath();

        assert.deepEqual(executablePath, superPythonPath);
        sinon.assert.calledOnce(superExecutablePathStub);
    });
});
