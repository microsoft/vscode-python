// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { ChildProcess, SpawnOptions } from 'child_process';
import { Container } from 'inversify';
import * as Rx from 'rxjs';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { IApplicationShell } from '../../client/common/application/types';
import { IPythonSettings } from '../../client/common/configSettings';
import { STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { PythonInstaller } from '../../client/common/installer/pythonInstallation';
import { IPlatformService } from '../../client/common/platform/types';
import { IInterpreterLocatorService } from '../../client/interpreter/contracts';
import { InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceContainer } from '../../client/ioc/types';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

class TestContext {
    public serviceManager: ServiceManager;
    public serviceContainer: IServiceContainer;
    public platform: TypeMoq.IMock<IPlatformService>;
    public appShell: TypeMoq.IMock<IApplicationShell>;
    public locator: TypeMoq.IMock<IInterpreterLocatorService>;
    public settings: TypeMoq.IMock<IPythonSettings>;
    public pythonInstaller: PythonInstaller;

    constructor(isMac: boolean) {
        const cont = new Container();
        this.serviceManager = new ServiceManager(cont);
        this.serviceContainer = new ServiceContainer(cont);

        this.platform = TypeMoq.Mock.ofType<IPlatformService>();
        this.appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        this.locator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        this.settings = TypeMoq.Mock.ofType<IPythonSettings>();

        this.serviceManager.addSingletonInstance<IPlatformService>(IPlatformService, this.platform.object);
        this.serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, this.appShell.object);
        this.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, this.locator.object);
        this.pythonInstaller = new PythonInstaller(this.serviceContainer);

        this.platform.setup(x => x.isMac).returns(() => isMac);
        this.platform.setup(x => x.isWindows).returns(() => !isMac);
    }
}

// tslint:disable-next-line:max-func-body-length
suite('Installation', () => {
    suiteSetup(async () => {
        await initialize();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('Disable checks', async () => {
        const c = new TestContext(false);
        let showErrorMessageCalled = false;

        c.settings.setup(s => s.disableInstallationChecks).returns(() => true);
        c.appShell.setup(x => x.showErrorMessage(TypeMoq.It.isAnyString())).callback(() => showErrorMessageCalled = true);
        const passed = await c.pythonInstaller.checkPythonInstallation(c.settings.object);
        assert.equal(passed, true, 'Disabling checks has no effect');
        assert.equal(showErrorMessageCalled, false, 'Disabling checks has no effect');
    });

    test('Python missing', async () => {
        const c = new TestContext(false);
        let showErrorMessageCalled = false;
        let openUrlCalled = false;
        let url;

        c.appShell.setup(x => x.showErrorMessage(TypeMoq.It.isAnyString())).callback(() => showErrorMessageCalled = true);
        c.appShell.setup(x => x.openUrl(TypeMoq.It.isAnyString())).callback((s: string) => {
            openUrlCalled = true;
            url = s;
        });
        c.locator.setup(x => x.getInterpreters()).returns(() => Promise.resolve([]));

        const passed = await c.pythonInstaller.checkPythonInstallation(c.settings.object);
        assert.equal(passed, false, 'Python reported as present');
        assert.equal(showErrorMessageCalled, true, 'Error message not shown');
        assert.equal(openUrlCalled, true, 'Python download page not opened');
        assert.equal(url, 'https://www.python.org/downloads', 'Python download page is incorrect');
    });

    test('Mac: Default Python warning', async () => {
        const c = new TestContext(true);
        let called = false;
        c.appShell.setup(x => x.showWarningMessage(TypeMoq.It.isAnyString())).callback(() => called = true);
        c.settings.setup(x => x.pythonPath).returns(() => 'python');
        const interpreter: PythonInterpreter = {
            path: 'python',
            type: InterpreterType.Unknown
        };
        c.locator.setup(x => x.getInterpreters()).returns(() => Promise.resolve([interpreter]));

        const passed = await c.pythonInstaller.checkPythonInstallation(c.settings.object);
        assert.equal(passed, true, 'Default MacOS Python not accepted');
        assert.equal(called, true, 'Warning not shown');
    });
});
