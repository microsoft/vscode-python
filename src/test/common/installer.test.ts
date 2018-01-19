import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { EnumEx } from '../../client/common/enumUtils';
import { createDeferred } from '../../client/common/helpers';
import { Installer } from '../../client/common/installer/installer';
import { IModuleInstaller } from '../../client/common/installer/types';
import { Logger } from '../../client/common/logger';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { IProcessService } from '../../client/common/process/types';
import { ICurrentProcess, IInstaller, ILogger, IPathUtils, IPersistentStateFactory, IsWindows, ModuleNamePurpose, Product } from '../../client/common/types';
import { updateSetting } from '../common';
import { rootWorkspaceUri } from '../common';
import { MockModuleInstaller } from '../mocks/moduleInstaller';
import { MockProcessService } from '../mocks/proc';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { closeActiveWindows, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Installer', () => {
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
        ioc.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        ioc.serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);

        ioc.registerMockProcessTypes();
        ioc.serviceManager.addSingletonInstance<boolean>(IsWindows, false);
    }
    async function resetSettings() {
        await updateSetting('linting.enabledWithoutWorkspace', true, undefined, ConfigurationTarget.Global);
        await updateSetting('linting.pylintEnabled', true, rootWorkspaceUri, ConfigurationTarget.Workspace);
    }

    async function testCheckingIfProductIsInstalled(product: Product) {
        const installer = ioc.serviceContainer.get<Installer>(IInstaller);
        const processService = ioc.serviceContainer.get<MockProcessService>(IProcessService);
        const checkInstalledDef = createDeferred<boolean>();
        processService.onExec((file, args, options, callback) => {
            const moduleName = installer.translateProductToModuleName(product, ModuleNamePurpose.run);
            if (args.length > 1 && args[0] === '-c' && args[1] === `import ${moduleName}`) {
                checkInstalledDef.resolve(true);
            }
            if (product === Product.prospector && args.length > 0 && args[0] === '--version') {
                checkInstalledDef.resolve(true);
            }
            callback({ stdout: '' });
        });
        await installer.isInstalled(product, resource);
        await checkInstalledDef.promise;
    }
    EnumEx.getNamesAndValues<Product>(Product).forEach(prod => {
        test(`Ensure isInstalled for Product: '${prod.name}' executes the right command`, async () => {
            ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('one', false));
            ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('two', true));
            if (prod.value === Product.ctags || prod.value === Product.unittest || prod.value === Product.isort) {
                return;
            }
            await testCheckingIfProductIsInstalled(prod.value);
        });
    });

    async function testInstallingProduct(product: Product) {
        const installer = ioc.serviceContainer.get<Installer>(IInstaller);
        const checkInstalledDef = createDeferred<boolean>();
        const moduleInstallers = ioc.serviceContainer.getAll<MockModuleInstaller>(IModuleInstaller);
        const moduleInstallerOne = moduleInstallers.find(item => item.displayName === 'two')!;

        moduleInstallerOne.on('installModule', moduleName => {
            const installName = installer.translateProductToModuleName(product, ModuleNamePurpose.install);
            if (installName === moduleName) {
                checkInstalledDef.resolve();
            }
        });
        await installer.install(product);
        await checkInstalledDef.promise;
    }
    EnumEx.getNamesAndValues<Product>(Product).forEach(prod => {
        test(`Ensure install for Product: '${prod.name}' executes the right command in IModuleInstaller`, async () => {
            ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('one', false));
            ioc.serviceManager.addSingletonInstance<IModuleInstaller>(IModuleInstaller, new MockModuleInstaller('two', true));
            if (prod.value === Product.unittest || prod.value === Product.ctags || prod.value === Product.isort) {
                return;
            }
            await testInstallingProduct(prod.value);
        });
    });

    test('Disable linting of files not contained in a workspace', async () => {
        const installer = ioc.serviceContainer.get<Installer>(IInstaller);
        await installer.disableLinter(Product.pylint, undefined);
        // tslint:disable-next-line:no-any
        const pythonConfig = workspace.getConfiguration('python', null as any as Uri);
        assert.equal(pythonConfig.get<boolean>('linting.enabledWithoutWorkspace'), false, 'Incorrect setting');
    });

    test('Disable linting of files contained in a single workspace', async function () {
        if (IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        const installer = ioc.serviceContainer.get<Installer>(IInstaller);
        await installer.disableLinter(Product.pylint, workspaceUri);
        const pythonConfig = workspace.getConfiguration('python', workspaceUri);
        assert.equal(pythonConfig.get<boolean>('linting.pylintEnabled'), false, 'Incorrect setting');
    });

    test('Disable linting of files contained in a any kind of workspace', async () => {
        const installer = ioc.serviceContainer.get<Installer>(IInstaller);
        await installer.disableLinter(Product.pylint, workspaceUri);
        const pythonConfig = workspace.getConfiguration('python', workspaceUri);
        assert.equal(pythonConfig.get<boolean>('linting.pylintEnabled'), false, 'Incorrect setting');
    });
});
