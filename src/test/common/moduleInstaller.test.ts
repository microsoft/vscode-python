import { assert, expect } from 'chai';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { EnumEx } from '../../client/common/enumUtils';
import { createDeferred } from '../../client/common/helpers';
import { CondaInstaller } from '../../client/common/installer/condaInstaller';
import { Installer } from '../../client/common/installer/installer';
import { PipInstaller } from '../../client/common/installer/pipInstaller';
import { IModuleInstaller } from '../../client/common/installer/types';
import { Logger } from '../../client/common/logger';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { IProcessService } from '../../client/common/process/types';
import { ITerminalService } from '../../client/common/terminal/types';
import { IInstaller, ILogger, IPathUtils, IPersistentStateFactory, IsWindows, ModuleNamePurpose, Product } from '../../client/common/types';
import { ICondaLocatorService } from '../../client/interpreter/contracts';
import { rootWorkspaceUri } from '../common';
import { updateSetting } from '../common';
import { MockCondaLocatorService } from '../interpreters/mocks';
import { MockCondaLocator } from '../mocks/condaLocator';
import { MockModuleInstaller } from '../mocks/moduleInstaller';
import { MockProcessService } from '../mocks/proc';
import { MockTerminalService } from '../mocks/terminalService';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { closeActiveWindows, initializeTest, IS_MULTI_ROOT_TEST, IS_TRAVIS } from './../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Module Installer', () => {
    let ioc: UnitTestIocContainer;
    const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
    const resource = IS_MULTI_ROOT_TEST ? workspaceUri : undefined;
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

        ioc.serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, PipInstaller);
        ioc.serviceManager.addSingleton<IModuleInstaller>(IModuleInstaller, CondaInstaller);
        ioc.serviceManager.addSingleton<ICondaLocatorService>(ICondaLocatorService, MockCondaLocator);
        ioc.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);

        ioc.registerMockProcessTypes();
        ioc.serviceManager.addSingleton<ITerminalService>(ITerminalService, MockTerminalService);
        ioc.serviceManager.addSingletonInstance<boolean>(IsWindows, false);
    }
    async function resetSettings() {
        await updateSetting('linting.enabledWithoutWorkspace', true, undefined, ConfigurationTarget.Global);
        await updateSetting('linting.pylintEnabled', true, rootWorkspaceUri, ConfigurationTarget.Workspace);
    }

    test('Ensure pip is supported and conda is not', async () => {
        ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('mock', true));
        const installer = ioc.serviceContainer.get<Installer>(IInstaller);
        const processService = ioc.serviceContainer.get<MockProcessService>(IProcessService);
        const checkInstalledDef = createDeferred<boolean>();
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
        expect(pipInstaller.isSupported()).to.eventually.equal(true, 'Pip is not supported');

        const condaInstaller = moduleInstallers.find(item => item.displayName === 'Conda')!;
        expect(condaInstaller).not.to.be.an('undefined', 'Conda installer not found');
        expect(condaInstaller.isSupported()).to.eventually.equal(false, 'Conda is supported');

        const mockInstaller = moduleInstallers.find(item => item.displayName === 'mock')!;
        expect(mockInstaller).not.to.be.an('undefined', 'mock installer not found');
        expect(mockInstaller.isSupported()).to.eventually.equal(false, 'mock is not supported');
    });

    test('Ensure pip and conda are supported', async () => {
        ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('mock', true));
        const installer = ioc.serviceContainer.get<Installer>(IInstaller);
        const processService = ioc.serviceContainer.get<MockProcessService>(IProcessService);
        const checkInstalledDef = createDeferred<boolean>();
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
        expect(pipInstaller.isSupported()).to.eventually.equal(true, 'Pip is not supported');

        const condaInstaller = moduleInstallers.find(item => item.displayName === 'Conda')!;
        expect(condaInstaller).not.to.be.an('undefined', 'Conda installer not found');
        expect(condaInstaller.isSupported()).to.eventually.equal(true, 'Conda is not supported');
    });

    test('Validate pip install arguments', async () => {
        const moduleName = 'xyz';
        const installer = ioc.serviceContainer.get<Installer>(IInstaller);
        const terminalService = ioc.serviceContainer.get<MockTerminalService>(ITerminalService);
        const validateModuleInstallArgs = createDeferred<boolean>();

        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip')!;

        expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');

        await pipInstaller.installModule(moduleName);
        const commandSent = await terminalService.commandSent;
        const commandParts = commandSent.split(' ');
        commandParts.shift();
        expect(commandParts.join(' ')).equal(`-m pip install -U ${moduleName}`, 'Invalid command sent to terminal for installation.');
    });

    test('Validate Conda install arguments', async () => {
        const moduleName = 'xyz';
        const installer = ioc.serviceContainer.get<Installer>(IInstaller);
        const terminalService = ioc.serviceContainer.get<MockTerminalService>(ITerminalService);
        const validateModuleInstallArgs = createDeferred<boolean>();

        const moduleInstallers = ioc.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip')!;

        expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');

        await pipInstaller.installModule(moduleName);
        const commandSent = await terminalService.commandSent;
        const commandParts = commandSent.split(' ');
        commandParts.shift();
        expect(commandParts.join(' ')).equal(`-m pip install -U ${moduleName}`, 'Invalid command sent to terminal for installation.');
    });
});
