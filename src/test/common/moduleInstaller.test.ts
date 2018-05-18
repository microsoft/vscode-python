import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { ConfigurationService } from '../../client/common/configuration/service';
import { CondaInstaller } from '../../client/common/installer/condaInstaller';
import { PipEnvInstaller } from '../../client/common/installer/pipEnvInstaller';
import { PipInstaller } from '../../client/common/installer/pipInstaller';
import { ProductInstaller } from '../../client/common/installer/productInstaller';
import { IModuleInstaller } from '../../client/common/installer/types';
import { Logger } from '../../client/common/logger';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { PlatformService } from '../../client/common/platform/platformService';
import { Architecture, IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../client/common/process/types';
import { ITerminalService, ITerminalServiceFactory } from '../../client/common/terminal/types';
import { IConfigurationService, ICurrentProcess, IInstaller, ILogger, IPathUtils, IPersistentStateFactory, IPythonSettings, IsWindows } from '../../client/common/types';
import { ICondaService, IInterpreterLocatorService, IInterpreterService, INTERPRETER_LOCATOR_SERVICE, InterpreterType, PIPENV_SERVICE, PythonInterpreter } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { PYTHON_PATH, rootWorkspaceUri } from '../common';
import { MockModuleInstaller } from '../mocks/moduleInstaller';
import { MockProcessService } from '../mocks/proc';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { closeActiveWindows, initializeTest } from './../initialize';

const info: PythonInterpreter = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: InterpreterType.Unknown,
    version: '',
    version_info: [0, 0, 0, 'alpha'],
    sysPrefix: '',
    sysVersion: ''
};

// tslint:disable-next-line:max-func-body-length
suite('Module Installer', () => {
    let ioc: UnitTestIocContainer;
    let mockTerminalService: TypeMoq.IMock<ITerminalService>;
    let condaService: TypeMoq.IMock<ICondaService>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;

    const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
    suiteSetup(initializeTest);
    setup(async () => {
        initializeDI();
        await initializeTest();
        await resetSettings();
    });
    suiteTeardown(async () => {
        await closeActiveWindows();
        await resetSettings();
    });
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
        ioc.registerLinterTypes();
        ioc.registerFormatterTypes();

        ioc.serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
        ioc.serviceManager.addSingleton<ILogger>(ILogger, Logger);
        ioc.serviceManager.addSingleton<IInstaller>(IInstaller, ProductInstaller);

        mockTerminalService = TypeMoq.Mock.ofType<ITerminalService>();
        const mockTerminalFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
        mockTerminalFactory.setup(t => t.getTerminalService(TypeMoq.It.isAny())).returns(() => mockTerminalService.object);
        ioc.serviceManager.addSingletonInstance<ITerminalServiceFactory>(ITerminalServiceFactory, mockTerminalFactory.object);

        ioc.serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller);
        ioc.serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller);
        ioc.serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipEnvInstaller);
        condaService = TypeMoq.Mock.ofType<ICondaService>();
        ioc.serviceManager.addSingletonInstance<ICondaService>(ICondaService, condaService.object);

        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        ioc.serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, interpreterService.object);

        ioc.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        ioc.serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
        ioc.serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
        ioc.serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
        ioc.serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);

        ioc.registerMockProcessTypes();
        ioc.serviceManager.addSingletonInstance<boolean>(IsWindows, false);
    }
    async function resetSettings(): Promise<void> {
        const configService = ioc.serviceManager.get<IConfigurationService>(IConfigurationService);
        await configService.updateSettingAsync('linting.pylintEnabled', true, rootWorkspaceUri, ConfigurationTarget.Workspace);
    }
    async function getCurrentPythonPath(): Promise<string> {
        const pythonPath = PythonSettings.getInstance(workspaceUri).pythonPath;
        if (path.basename(pythonPath) === pythonPath) {
            const pythonProc = await ioc.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create({ resource: workspaceUri });
            return pythonProc.getExecutablePath().catch(() => pythonPath);
        } else {
            return pythonPath;
        }
    }
    test('Ensure pip is supported and conda is not', async () => {
        ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('mock', true));
        const mockInterpreterLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, mockInterpreterLocator.object, INTERPRETER_LOCATOR_SERVICE);
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, TypeMoq.Mock.ofType<IInterpreterLocatorService>().object, PIPENV_SERVICE);

        const processService = await ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create() as MockProcessService;
        processService.onExec((file, args, options, callback) => {
            if (args.length > 1 && args[0] === '-c' && args[1] === 'import pip') {
                callback({ stdout: '' });
            }
            if (args.length > 0 && args[0] === '--version' && file === 'conda') {
                callback({ stdout: '', stderr: 'not available' });
            }
        });
        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        expect(moduleInstallers).length(4, 'Incorrect number of installers');

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

    test('Ensure pip is supported', async () => {
        ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('mock', true));
        const pythonPath = await getCurrentPythonPath();
        const mockInterpreterLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([{ ...info, architecture: Architecture.Unknown, companyDisplayName: '', displayName: '', envName: '', path: pythonPath, type: InterpreterType.Conda, version: '' }]));
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, mockInterpreterLocator.object, INTERPRETER_LOCATOR_SERVICE);
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, TypeMoq.Mock.ofType<IInterpreterLocatorService>().object, PIPENV_SERVICE);

        const processService = await ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create() as MockProcessService;
        processService.onExec((file, args, options, callback) => {
            if (args.length > 1 && args[0] === '-c' && args[1] === 'import pip') {
                callback({ stdout: '' });
            }
            if (args.length > 0 && args[0] === '--version' && file === 'conda') {
                callback({ stdout: '' });
            }
        });
        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        expect(moduleInstallers).length(4, 'Incorrect number of installers');

        const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip')!;
        expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');
        await expect(pipInstaller.isSupported()).to.eventually.equal(true, 'Pip is not supported');
    });
    test('Ensure conda is supported', async () => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
        const settings = TypeMoq.Mock.ofType<IPythonSettings>();
        const pythonPath = 'pythonABC';
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICondaService))).returns(() => condaService.object);
        condaService.setup(c => c.isCondaAvailable()).returns(() => Promise.resolve(true));
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));

        const condaInstaller = new CondaInstaller(serviceContainer.object);
        await expect(condaInstaller.isSupported()).to.eventually.equal(true, 'Conda is not supported');
    });
    test('Ensure conda is not supported even if conda is available', async () => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
        const settings = TypeMoq.Mock.ofType<IPythonSettings>();
        const pythonPath = 'pythonABC';
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICondaService))).returns(() => condaService.object);
        condaService.setup(c => c.isCondaAvailable()).returns(() => Promise.resolve(true));
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(false));

        const condaInstaller = new CondaInstaller(serviceContainer.object);
        await expect(condaInstaller.isSupported()).to.eventually.equal(false, 'Conda should not be supported');
    });

    test('Validate pip install arguments', async () => {
        const interpreterPath = await getCurrentPythonPath();
        const mockInterpreterLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([{ ...info, path: interpreterPath, type: InterpreterType.Unknown }]));
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, mockInterpreterLocator.object, INTERPRETER_LOCATOR_SERVICE);
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, TypeMoq.Mock.ofType<IInterpreterLocatorService>().object, PIPENV_SERVICE);

        const interpreter: PythonInterpreter = {
            ...info,
            type: InterpreterType.Unknown,
            path: PYTHON_PATH
        };
        interpreterService.setup(x => x.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve(interpreter));

        const moduleName = 'xyz';

        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip')!;

        expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');

        let argsSent: string[] = [];
        mockTerminalService
            .setup(t => t.sendCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
            .returns((cmd: string, args: string[]) => { argsSent = args; return Promise.resolve(void 0); });
        // tslint:disable-next-line:no-any
        interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve({ type: InterpreterType.Unknown } as any));
        await pipInstaller.installModule(moduleName);

        expect(argsSent.join(' ')).equal(`-m pip install -U ${moduleName} --user`, 'Invalid command sent to terminal for installation.');
    });

    test('Validate Conda install arguments', async () => {
        const interpreterPath = await getCurrentPythonPath();
        const mockInterpreterLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([{ ...info, path: interpreterPath, type: InterpreterType.Conda }]));
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, mockInterpreterLocator.object, INTERPRETER_LOCATOR_SERVICE);
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, TypeMoq.Mock.ofType<IInterpreterLocatorService>().object, PIPENV_SERVICE);

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

    test('Validate pipenv install arguments', async () => {
        const mockInterpreterLocator = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([{ ...info, path: 'interpreterPath', type: InterpreterType.VirtualEnv }]));
        ioc.serviceManager.addSingletonInstance<IInterpreterLocatorService>(IInterpreterLocatorService, mockInterpreterLocator.object, PIPENV_SERVICE);

        const moduleName = 'xyz';
        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        const pipInstaller = moduleInstallers.find(item => item.displayName === 'pipenv')!;

        expect(pipInstaller).not.to.be.an('undefined', 'pipenv installer not found');

        let argsSent: string[] = [];
        let command: string | undefined;
        mockTerminalService
            .setup(t => t.sendCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
            .returns((cmd: string, args: string[]) => {
                argsSent = args;
                command = cmd;
                return Promise.resolve(void 0);
            });

        await pipInstaller.installModule(moduleName);

        expect(command!).equal('pipenv', 'Invalid command sent to terminal for installation.');
        expect(argsSent.join(' ')).equal(`install ${moduleName} --dev`, 'Invalid command arguments sent to terminal for installation.');
    });
});
