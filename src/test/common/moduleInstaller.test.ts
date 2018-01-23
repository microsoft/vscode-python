import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { CondaInstaller } from '../../client/common/installer/condaInstaller';
import { Installer } from '../../client/common/installer/installer';
import { PipInstaller } from '../../client/common/installer/pipInstaller';
import { IModuleInstaller } from '../../client/common/installer/types';
import { Logger } from '../../client/common/logger';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { PlatformService } from '../../client/common/platform/platformService';
import { Architecture, IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { IProcessService, IPythonExecutionFactory } from '../../client/common/process/types';
import { ITerminalService } from '../../client/common/terminal/types';
import { ICurrentProcess, IInstaller, ILogger, IPathUtils, IPersistentStateFactory, IsWindows } from '../../client/common/types';
import { ICondaLocatorService, IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE, InterpreterType } from '../../client/interpreter/contracts';
import { rootWorkspaceUri, updateSetting } from '../common';
import { MockProvider } from '../interpreters/mocks';
import { MockCondaLocator } from '../mocks/condaLocator';
import { MockModuleInstaller } from '../mocks/moduleInstaller';
import { MockProcessService } from '../mocks/proc';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { closeActiveWindows, initializeTest } from './../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Module Installer', () => {
    let ioc: UnitTestIocContainer;
    let mockTerminalService: TypeMoq.IMock<ITerminalService>;
    const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
    suiteSetup(initializeTest);
    setup(async () => {
        await initializeTest();
        await resetSettings();
        initializeDI();
    });
    suiteTeardown(async () => {
        await closeActiveWindows();
        await resetSettings();
    });
    teardown(async () => {
        ioc.dispose();
        closeActiveWindows();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
        ioc.registerLinterTypes();
        ioc.registerFormatterTypes();

        ioc.serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
        ioc.serviceManager.addSingleton<ILogger>(ILogger, Logger);
        ioc.serviceManager.addSingleton<IInstaller>(IInstaller, Installer);

        mockTerminalService = TypeMoq.Mock.ofType<ITerminalService>();
        ioc.serviceManager.addSingletonInstance<ITerminalService>(ITerminalService, mockTerminalService.object);

        ioc.serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller);
        ioc.serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller);
        ioc.serviceManager.addSingleton<ICondaLocatorService>(ICondaLocatorService, MockCondaLocator);
        ioc.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        ioc.serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
        ioc.serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
        ioc.serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);

        ioc.registerMockProcessTypes();
        ioc.serviceManager.addSingletonInstance<boolean>(IsWindows, false);
    }
    async function resetSettings() {
        await updateSetting('linting.enabledWithoutWorkspace', true, undefined, ConfigurationTarget.Global);
        await updateSetting('linting.pylintEnabled', true, rootWorkspaceUri, ConfigurationTarget.Workspace);
    }
    async function getCurrentPythonPath(): Promise<string> {
        const pythonPath = PythonSettings.getInstance(workspaceUri).pythonPath;
        if (path.basename(pythonPath) === pythonPath) {
            const pythonProc = await ioc.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create(workspaceUri);
            return pythonProc.getExecutablePath().catch(() => pythonPath);
        } else {
            return pythonPath;
        }
    }
    test('Ensure pip is supported and conda is not', async () => {
        ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('mock', true));
        const mockInterpreterLocator = new MockProvider([]);
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, mockInterpreterLocator, INTERPRETER_LOCATOR_SERVICE);

        const processService = ioc.serviceContainer.get<MockProcessService>(IProcessService);
        processService.onExec((file, args, options, callback) => {
            if (args.length > 1 && args[0] === '-c' && args[1] === 'import pip') {
                callback({ stdout: '' });
            }
            if (args.length > 0 && args[0] === '--version' && file === 'conda') {
                callback({ stdout: '', stderr: 'not available' });
            }
        });
        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        expect(moduleInstallers).length(3, 'Incorrect number of installers');

        const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip')!;
        expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');
        await expect(pipInstaller.isSupported()).to.eventually.equal(true, 'Pip is not supported');

        const condaInstaller = moduleInstallers.find(item => item.displayName === 'Conda')!;
        expect(condaInstaller).not.to.be.an('undefined', 'Conda installer not found');
        await expect(condaInstaller.isSupported()).to.eventually.equal(false, 'Conda is supported');

        const mockInstaller = moduleInstallers.find(item => item.displayName === 'mock')!;
        expect(mockInstaller).not.to.be.an('undefined', 'mock installer not found');
        await expect(mockInstaller.isSupported()).to.eventually.equal(true, 'mock is not supported');
    });

    test('Ensure pip and conda are supported', async () => {
        ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('mock', true));
        const pythonPath = await getCurrentPythonPath();
        const mockInterpreterLocator = new MockProvider([{ architecture: Architecture.Unknown, companyDisplayName: '', displayName: '', envName: '', path: pythonPath, type: InterpreterType.Conda, version: '' }]);
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, mockInterpreterLocator, INTERPRETER_LOCATOR_SERVICE);

        const processService = ioc.serviceContainer.get<MockProcessService>(IProcessService);
        processService.onExec((file, args, options, callback) => {
            if (args.length > 1 && args[0] === '-c' && args[1] === 'import pip') {
                callback({ stdout: '' });
            }
            if (args.length > 0 && args[0] === '--version' && file === 'conda') {
                callback({ stdout: '' });
            }
        });
        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        expect(moduleInstallers).length(3, 'Incorrect number of installers');

        const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip')!;
        expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');
        await expect(pipInstaller.isSupported()).to.eventually.equal(true, 'Pip is not supported');

        const condaInstaller = moduleInstallers.find(item => item.displayName === 'Conda')!;
        expect(condaInstaller).not.to.be.an('undefined', 'Conda installer not found');
        await expect(condaInstaller.isSupported()).to.eventually.equal(true, 'Conda is not supported');
    });

    test('Validate pip install arguments', async () => {
        const mockInterpreterLocator = new MockProvider([{ path: await getCurrentPythonPath(), type: InterpreterType.Unknown }]);
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, mockInterpreterLocator, INTERPRETER_LOCATOR_SERVICE);

        const moduleName = 'xyz';

        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip')!;

        expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');

        let argsSent: string[] = [];
        mockTerminalService
            .setup(t => t.sendCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
            .returns((cmd: string, args: string[]) => { argsSent = args; return Promise.resolve(void 0); });
        await pipInstaller.installModule(moduleName);

        expect(argsSent.join(' ')).equal(`-m pip install -U ${moduleName} --user`, 'Invalid command sent to terminal for installation.');
    });

    test('Validate Conda install arguments', async () => {
        const mockInterpreterLocator = new MockProvider([{ path: await getCurrentPythonPath(), type: InterpreterType.Conda }]);
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, mockInterpreterLocator, INTERPRETER_LOCATOR_SERVICE);

        const moduleName = 'xyz';

        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip')!;

        expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');

        let argsSent: string[] = [];
        mockTerminalService
            .setup(t => t.sendCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
            .returns((cmd: string, args: string[]) => { argsSent = args; return Promise.resolve(void 0); });

        await pipInstaller.installModule(moduleName);

        expect(argsSent.join(' ')).equal(`-m pip install -U ${moduleName}`, 'Invalid command sent to terminal for installation.');
    });
});
