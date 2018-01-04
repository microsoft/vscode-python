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
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IProcessService, ObservableExecutionResult, Output } from '../../client/common/process/types';
import { IOutputChannel } from '../../client/common/types';
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
    public fileSystem: TypeMoq.IMock<IFileSystem>;
    public appShell: TypeMoq.IMock<IApplicationShell>;
    public locator: TypeMoq.IMock<IInterpreterLocatorService>;
    public settings: TypeMoq.IMock<IPythonSettings>;
    public process: TypeMoq.IMock<IProcessService>;
    public output: TypeMoq.IMock<vscode.OutputChannel>;
    public pythonInstaller: PythonInstaller;

    constructor(isMac: boolean) {
        const cont = new Container();
        this.serviceManager = new ServiceManager(cont);
        this.serviceContainer = new ServiceContainer(cont);

        this.platform = TypeMoq.Mock.ofType<IPlatformService>();
        this.fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        this.appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        this.locator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        this.settings = TypeMoq.Mock.ofType<IPythonSettings>();
        this.process = TypeMoq.Mock.ofType<IProcessService>();
        this.output = TypeMoq.Mock.ofType<vscode.OutputChannel>();

        this.serviceManager.addSingletonInstance<IPlatformService>(IPlatformService, this.platform.object);
        this.serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, this.fileSystem.object);
        this.serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, this.appShell.object);
        this.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, this.locator.object);
        this.serviceManager.addSingletonInstance<IProcessService>(IProcessService, this.process.object);
        this.serviceManager.addSingletonInstance<vscode.OutputChannel>(IOutputChannel, this.output.object, STANDARD_OUTPUT_CHANNEL);
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

    test('Windows: Python missing', async () => {
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

    test('Mac: Python missing', async () => {
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

    test('Mac: Default Python, user refused install', async () => {
        const c = new TestContext(true);
        let errorMessage = '';

        c.appShell
            .setup(x => x.showErrorMessage(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .callback((m: string, a1: string, a2: string) => errorMessage = m)
            .returns(() => Promise.resolve('No'));
        c.locator.setup(x => x.getInterpreters()).returns(() => Promise.resolve([]));

        const passed = await c.pythonInstaller.checkPythonInstallation(c.settings.object);
        assert.equal(passed, false, 'Default MacOS Python accepted');
        assert.equal(errorMessage.startsWith('Python that comes with MacOS is not supported'), true, 'Error message that MacOS Python not supported not shown');
    });

    test('Mac: Default Python, Brew installation', async () => {
        const c = new TestContext(true);
        let errorMessage = '';
        let processName = '';
        let args;
        let brewPath;
        let outputShown = false;

        c.appShell
            .setup(x => x.showErrorMessage(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns(() => Promise.resolve('Yes'));
        c.appShell
            .setup(x => x.showErrorMessage(TypeMoq.It.isAnyString()))
            .callback((m: string) => errorMessage = m);
        c.locator.setup(x => x.getInterpreters()).returns(() => Promise.resolve([]));
        c.fileSystem
            .setup(x => x.fileExistsAsync(TypeMoq.It.isAnyString()))
            .returns((p: string) => {
                brewPath = p;
                return Promise.resolve(false);
            });

        const childProcess = TypeMoq.Mock.ofType<ChildProcess>();
        childProcess
            .setup(p => p.on('exit', TypeMoq.It.isAny()))
            .callback((e: string, listener: (code, signal) => void) => {
                listener.call(0, undefined);
            });
        const processOutput: Output<string> = {
            source: 'stdout',
            out: 'started'
        };
        const observable = new Rx.Observable<Output<string>>(subscriber => subscriber.next(processOutput));
        const brewInstallProcess: ObservableExecutionResult<string> = {
            proc: childProcess.object,
            out: observable
        };

        c.output.setup(x => x.show()).callback(() => outputShown = true);
        c.process
            .setup(x => x.execObservable(TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((p: string, a: string[], o: SpawnOptions) => {
                processName = p;
                args = a;
            })
            .returns(() => brewInstallProcess);

        await c.pythonInstaller.checkPythonInstallation(c.settings.object);

        assert.notEqual(brewPath, undefined, 'Brew installer location not checked');
        assert.equal(brewPath, '/usr/local/bin/brew', 'Brew installer location is incorrect');
        assert.notEqual(processName, undefined, 'Brew installer not invoked');
        assert.equal(processName, '/usr/bin/ruby', 'Brew installer name is incorrect');
        assert.equal(args[0], '-e', 'Brew installer argument is incorrect');
        assert.equal(args[1], '"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"', 'Homebrew installer argument is incorrect');
        assert.equal(outputShown, true, 'Output panel not shown');
        assert.equal(errorMessage.startsWith('Unable to install Homebrew'), true, 'Homebrew install failed message no shown');

        c.fileSystem
            .setup(x => x.fileExistsAsync(TypeMoq.It.isAnyString()))
            .returns(() => Promise.resolve(true));
        errorMessage = '';

        await c.pythonInstaller.checkPythonInstallation(c.settings.object);
        assert.equal(errorMessage, '', `Unexpected error message ${errorMessage}`);
        assert.equal(processName, 'brew', 'Brew installer name is incorrect');
        assert.equal(args[0], 'install', 'Brew "install" argument is incorrect');
        assert.equal(args[1], 'python', 'Brew "python" argument is incorrect');
    });
});
