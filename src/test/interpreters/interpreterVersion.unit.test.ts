// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import '../../client/common/extensions';
import { IProcessServiceFactory } from '../../client/common/process/types';
import { IInterpreterVersionService } from '../../client/interpreter/contracts';
import { PIP_VERSION_REGEX } from '../../client/interpreter/interpreterVersion';
import { PYTHON_PATH } from '../common';
import { initialize, initializeTest } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

use(chaiAsPromised);

suite('Interpreters display version', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(initialize);
    setup(async () => {
        initializeDI();
        await initializeTest();
    });
    teardown(() => ioc.dispose());

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerInterpreterTypes();
    }

    test('Must return the Python Version', async () => {
        const pythonProcess = await ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create();
        const output = await pythonProcess.exec(PYTHON_PATH, ['--version'], { cwd: __dirname, mergeStdOutErr: true });
        const version = output.stdout.splitLines()[0];
        const interpreterVersion = ioc.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        const pyVersion = await interpreterVersion.getVersion(PYTHON_PATH, 'DEFAULT_TEST_VALUE');
        assert.equal(pyVersion, version, 'Incorrect version');
    });
    test('Must return the default value when Python path is invalid', async () => {
        const interpreterVersion = ioc.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        const pyVersion = await interpreterVersion.getVersion('INVALID_INTERPRETER', 'DEFAULT_TEST_VALUE');
        assert.equal(pyVersion, 'DEFAULT_TEST_VALUE', 'Incorrect version');
    });
    test('Must return the pip Version.', async () => {
        const pythonProcess = await ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create();
        const result = await pythonProcess.exec(PYTHON_PATH, ['-m', 'pip', '--version'], { cwd: __dirname, mergeStdOutErr: true });
        const output = result.stdout.splitLines()[0];
        // Take the second part, see below example.
        // pip 9.0.1 from /Users/donjayamanne/anaconda3/lib/python3.6/site-packages (python 3.6).
        const re = new RegExp(PIP_VERSION_REGEX, 'g');
        const matches = re.exec(output);
        assert.isNotNull(matches, 'No matches for version found');
        // tslint:disable-next-line:no-non-null-assertion
        assert.isAtLeast(matches!.length, 1, 'Version number not found');

        const interpreterVersion = ioc.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        const pipVersionPromise = interpreterVersion.getPipVersion(PYTHON_PATH);
        // tslint:disable-next-line:no-non-null-assertion
        await expect(pipVersionPromise).to.eventually.equal(matches![0].trim());
    });
    test('Must throw an exception when pip version cannot be determined', async () => {
        const interpreterVersion = ioc.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        const pipVersionPromise = interpreterVersion.getPipVersion('INVALID_INTERPRETER');
        await expect(pipVersionPromise).to.be.rejectedWith();
    });
});
