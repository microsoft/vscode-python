import * as assert from 'assert';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IPlatformService, RegistryHive } from '../../client/common/platform/types';
import { IPathUtils, IPersistentStateFactory } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { IInterpreterHelper } from '../../client/interpreter/contracts';
import { WindowsRegistryService } from '../../client/interpreter/locators/services/windowsRegistryService';
import { IServiceContainer } from '../../client/ioc/types';
import { MockRegistry, MockState } from './mocks';

const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');

// tslint:disable-next-line:max-func-body-length
suite('Interpreters from Windows Registry (unit)', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let interpreterHelper: TypeMoq.IMock<IInterpreterHelper>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const stateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        interpreterHelper = TypeMoq.Mock.ofType<IInterpreterHelper>();
        const pathUtils = TypeMoq.Mock.ofType<IPathUtils>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPersistentStateFactory))).returns(() => stateFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterHelper))).returns(() => interpreterHelper.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPathUtils))).returns(() => pathUtils.object);
        pathUtils.setup(p => p.basename(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((p: string) => p.split(/[\\,\/]/).reverse()[0]);
        const state = new MockState(undefined);
        // tslint:disable-next-line:no-empty no-any
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({} as any));
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => state);
    });
    function setup64Bit(is64Bit: boolean) {
        platformService.setup(ps => ps.is64bit).returns(() => is64Bit);
        return platformService.object;
    }
    test('Must return an empty list (x86)', async () => {
        const registry = new MockRegistry([], []);
        const winRegistry = new WindowsRegistryService(registry, setup64Bit(false), serviceContainer.object);

        const interpreters = await winRegistry.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });
    test('Must return an empty list (x64)', async () => {
        const registry = new MockRegistry([], []);
        const winRegistry = new WindowsRegistryService(registry, setup64Bit(true), serviceContainer.object);

        const interpreters = await winRegistry.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });
    test('Must return a single entry', async () => {
        const registryKeys = [
            { key: '\\Software\\Python', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One'] },
            { key: '\\Software\\Python\\Company One', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\Company One', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path1') },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path1', 'one.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company One\\Tag1', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Version.Tag1', name: 'SysVersion' },
            { key: '\\Software\\Python\\Company One\\Tag1', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' }
        ];
        const registry = new MockRegistry(registryKeys, registryValues);
        const winRegistry = new WindowsRegistryService(registry, setup64Bit(false), serviceContainer.object);

        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: Architecture.x86 }));

        const interpreters = await winRegistry.getInterpreters();

        assert.equal(interpreters.length, 1, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'path1', 'one.exe'), 'Incorrect executable path');
        assert.equal(interpreters[0].version, 'Version.Tag1', 'Incorrect version');
    });
    test('Must default names for PythonCore and exe', async () => {
        const registryKeys = [
            { key: '\\Software\\Python', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\PythonCore'] },
            { key: '\\Software\\Python\\PythonCore', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\PythonCore\\Tag1'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\PythonCore\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path1') }
        ];
        const registry = new MockRegistry(registryKeys, registryValues);
        const winRegistry = new WindowsRegistryService(registry, setup64Bit(false), serviceContainer.object);

        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: Architecture.x86 }));

        const interpreters = await winRegistry.getInterpreters();

        assert.equal(interpreters.length, 1, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Python Software Foundation', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'path1', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');
    });
    test('Must ignore company \'PyLauncher\'', async () => {
        const registryKeys = [
            { key: '\\Software\\Python', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\PyLauncher'] },
            { key: '\\Software\\Python\\PythonCore', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\PyLauncher\\Tag1'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\PyLauncher\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'c:/temp/Install Path Tag1' }
        ];
        const registry = new MockRegistry(registryKeys, registryValues);
        const winRegistry = new WindowsRegistryService(registry, setup64Bit(false), serviceContainer.object);

        const interpreters = await winRegistry.getInterpreters();

        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });
    test('Must return a single entry and when registry contains only the InstallPath', async () => {
        const registryKeys = [
            { key: '\\Software\\Python', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One'] },
            { key: '\\Software\\Python\\Company One', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path1') }
        ];
        const registry = new MockRegistry(registryKeys, registryValues);
        const winRegistry = new WindowsRegistryService(registry, setup64Bit(false), serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: Architecture.x86 }));

        const interpreters = await winRegistry.getInterpreters();

        assert.equal(interpreters.length, 1, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Company One', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'path1', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');
    });
    test('Must return multiple entries', async () => {
        const registryKeys = [
            { key: '\\Software\\Python', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One', '\\Software\\Python\\Company Two', '\\Software\\Python\\Company Three'] },
            { key: '\\Software\\Python\\Company One', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1', '\\Software\\Python\\Company One\\Tag2'] },
            { key: '\\Software\\Python\\Company Two', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Two\\Tag A', '\\Software\\Python\\Company Two\\Tag B', '\\Software\\Python\\Company Two\\Tag C'] },
            { key: '\\Software\\Python\\Company Three', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Three\\Tag !'] },
            { key: '\\Software\\Python', hive: RegistryHive.HKLM, arch: Architecture.x86, values: ['A'] },
            { key: '\\Software\\Python\\Company A', hive: RegistryHive.HKLM, arch: Architecture.x86, values: ['Another Tag'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\Company One', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path1') },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path1', 'python.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path2'), name: 'SysVersion' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' },

            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path2') },
            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path2', 'python.exe'), name: 'ExecutablePath' },

            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path3') },
            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Version.Tag A', name: 'SysVersion' },

            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag B', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company Two\\Tag C\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'scipy') },

            { key: '\\Software\\Python\\Company Three\\Tag !\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },

            { key: '\\Software\\Python\\Company A\\Another Tag\\InstallPath', hive: RegistryHive.HKLM, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'scipy', 'python.exe') }
        ];
        const registry = new MockRegistry(registryKeys, registryValues);
        const winRegistry = new WindowsRegistryService(registry, setup64Bit(false), serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: Architecture.x86 }));

        const interpreters = await winRegistry.getInterpreters();

        assert.equal(interpreters.length, 4, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'path1', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');

        assert.equal(interpreters[1].architecture, Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[1].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[1].path, path.join(environmentsPath, 'path2', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[1].version, 'Tag2', 'Incorrect version');

        assert.equal(interpreters[2].architecture, Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[2].companyDisplayName, 'Company Two', 'Incorrect company name');
        assert.equal(interpreters[2].path, path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[2].version, 'Tag B', 'Incorrect version');
    });
    test('Must return multiple entries excluding the invalid registry items and duplicate paths', async () => {
        const registryKeys = [
            { key: '\\Software\\Python', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One', '\\Software\\Python\\Company Two', '\\Software\\Python\\Company Three', '\\Software\\Python\\Company Four', '\\Software\\Python\\Company Five', 'Missing Tag'] },
            { key: '\\Software\\Python\\Company One', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1', '\\Software\\Python\\Company One\\Tag2'] },
            { key: '\\Software\\Python\\Company Two', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Two\\Tag A', '\\Software\\Python\\Company Two\\Tag B', '\\Software\\Python\\Company Two\\Tag C'] },
            { key: '\\Software\\Python\\Company Three', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Three\\Tag !'] },
            { key: '\\Software\\Python\\Company Four', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Four\\Four !'] },
            { key: '\\Software\\Python\\Company Five', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Five\\Five !'] },
            { key: '\\Software\\Python', hive: RegistryHive.HKLM, arch: Architecture.x86, values: ['A'] },
            { key: '\\Software\\Python\\Company A', hive: RegistryHive.HKLM, arch: Architecture.x86, values: ['Another Tag'] }
        ];
        const registryValues: { key: string; hive: RegistryHive; arch?: Architecture; value: string; name?: string }[] = [
            { key: '\\Software\\Python\\Company One', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Version.Tag1', name: 'SysVersion' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' },

            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'scipy') },
            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'scipy', 'python.exe'), name: 'ExecutablePath' },

            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path1') },
            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Version.Tag A', name: 'SysVersion' },

            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path2') },
            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag B', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company Two\\Tag C\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },

            // tslint:disable-next-line:no-any
            { key: '\\Software\\Python\\Company Five\\Five !\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: <any>undefined },

            { key: '\\Software\\Python\\Company Three\\Tag !\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },

            { key: '\\Software\\Python\\Company A\\Another Tag\\InstallPath', hive: RegistryHive.HKLM, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') }
        ];
        const registry = new MockRegistry(registryKeys, registryValues);
        const winRegistry = new WindowsRegistryService(registry, setup64Bit(false), serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: Architecture.x86 }));

        const interpreters = await winRegistry.getInterpreters();

        assert.equal(interpreters.length, 4, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');

        assert.equal(interpreters[1].architecture, Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[1].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[1].path, path.join(environmentsPath, 'conda', 'envs', 'scipy', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[1].version, 'Tag2', 'Incorrect version');

        assert.equal(interpreters[2].architecture, Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[2].companyDisplayName, 'Company Two', 'Incorrect company name');
        assert.equal(interpreters[2].path, path.join(environmentsPath, 'path1', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[2].version, 'Tag A', 'Incorrect version');
    });
    test('Must return multiple entries excluding the invalid registry items and nonexistent paths', async () => {
        const registryKeys = [
            { key: '\\Software\\Python', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One', '\\Software\\Python\\Company Two', '\\Software\\Python\\Company Three', '\\Software\\Python\\Company Four', '\\Software\\Python\\Company Five', 'Missing Tag'] },
            { key: '\\Software\\Python\\Company One', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1', '\\Software\\Python\\Company One\\Tag2'] },
            { key: '\\Software\\Python\\Company Two', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Two\\Tag A', '\\Software\\Python\\Company Two\\Tag B', '\\Software\\Python\\Company Two\\Tag C'] },
            { key: '\\Software\\Python\\Company Three', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Three\\Tag !'] },
            { key: '\\Software\\Python\\Company Four', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Four\\Four !'] },
            { key: '\\Software\\Python\\Company Five', hive: RegistryHive.HKCU, arch: Architecture.x86, values: ['\\Software\\Python\\Company Five\\Five !'] },
            { key: '\\Software\\Python', hive: RegistryHive.HKLM, arch: Architecture.x86, values: ['A'] },
            { key: '\\Software\\Python\\Company A', hive: RegistryHive.HKLM, arch: Architecture.x86, values: ['Another Tag'] }
        ];
        const registryValues: { key: string; hive: RegistryHive; arch?: Architecture; value: string; name?: string }[] = [
            { key: '\\Software\\Python\\Company One', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Version.Tag1', name: 'SysVersion' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' },

            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'scipy') },
            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'scipy', 'python.exe'), name: 'ExecutablePath' },

            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'non-existent-path') },
            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'Version.Tag A', name: 'SysVersion' },

            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'path2') },
            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: 'DisplayName.Tag B', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company Two\\Tag C\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'numpy') },

            // tslint:disable-next-line:no-any
            { key: '\\Software\\Python\\Company Five\\Five !\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: <any>undefined },

            { key: '\\Software\\Python\\Company Three\\Tag !\\InstallPath', hive: RegistryHive.HKCU, arch: Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'numpy') },

            { key: '\\Software\\Python\\Company A\\Another Tag\\InstallPath', hive: RegistryHive.HKLM, arch: Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'numpy') }
        ];
        const registry = new MockRegistry(registryKeys, registryValues);
        const winRegistry = new WindowsRegistryService(registry, setup64Bit(false), serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: Architecture.x86 }));

        const interpreters = await winRegistry.getInterpreters();

        assert.equal(interpreters.length, 2, 'Incorrect number of entries');

        assert.equal(interpreters[0].architecture, Architecture.x86, '1. Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', '1. Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), '1. Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', '1. Incorrect version');

        assert.equal(interpreters[1].architecture, Architecture.x86, '2. Incorrect arhictecture');
        assert.equal(interpreters[1].companyDisplayName, 'Company Two', '2. Incorrect company name');
        assert.equal(interpreters[1].path, path.join(environmentsPath, 'path2', 'python.exe'), '2. Incorrect path');
        assert.equal(interpreters[1].version, 'Tag B', '2. Incorrect version');
    });
});
