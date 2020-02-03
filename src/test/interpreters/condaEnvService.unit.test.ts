import * as assert from 'assert';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IFileSystem } from '../../client/common/platform/types';
import { IPersistentStateFactory } from '../../client/common/types';
import { ICondaService, InterpreterType } from '../../client/interpreter/contracts';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { AnacondaCompanyName } from '../../client/interpreter/locators/services/conda';
import { CondaEnvService, parseCondaInfo } from '../../client/interpreter/locators/services/condaEnvService';
import { IServiceContainer } from '../../client/ioc/types';
import { UnitTestIocContainer } from '../testing/serviceRegistry';
import { MockState } from './mocks';

const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');

// tslint:disable-next-line:max-func-body-length
suite('Interpreters from Conda Environments', () => {
    let ioc: UnitTestIocContainer;
    let condaProvider: CondaEnvService;
    let condaService: TypeMoq.IMock<ICondaService>;
    let interpreterHelper: TypeMoq.IMock<InterpreterHelper>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    setup(() => {
        initializeDI();
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const stateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new MockState(undefined);
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => state);

        condaService = TypeMoq.Mock.ofType<ICondaService>();
        interpreterHelper = TypeMoq.Mock.ofType<InterpreterHelper>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        condaProvider = new CondaEnvService(condaService.object, interpreterHelper.object, serviceContainer.object, fileSystem.object);
    });
    teardown(() => ioc.dispose());
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }

    test('Must return an empty list for empty json', async () => {
        const interpreters = await parseCondaInfo(
            // tslint:disable-next-line:no-any prefer-type-cast
            {} as any,
            condaService.object,
            fileSystem.object,
            interpreterHelper.object
        );
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });

    async function extractDisplayNameFromVersionInfo(isWindows: boolean) {
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy'), path.join(environmentsPath, 'conda', 'envs', 'scipy')],
            default_prefix: '',
            'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        condaService
            .setup(c => c.getInterpreterPath(TypeMoq.It.isAny()))
            .returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
        info.envs.forEach(validPath => {
            const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        });
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: undefined }));

        const interpreters = await parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);
        assert.equal(interpreters.length, 2, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
        assert.equal(interpreters[0].type, InterpreterType.Conda, 'Environment not detected as a conda environment');

        const path2 = path.join(info.envs[1], isWindows ? 'python.exe' : path.join('bin', 'python'));
        assert.equal(interpreters[1].path, path2, 'Incorrect path for first env');
        assert.equal(interpreters[1].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
        assert.equal(interpreters[1].type, InterpreterType.Conda, 'Environment not detected as a conda environment');
    }
    test('Must extract display name from version info (non windows)', async () => {
        await extractDisplayNameFromVersionInfo(false);
    });
    test('Must extract display name from version info (windows)', async () => {
        await extractDisplayNameFromVersionInfo(true);
    });
    async function extractDisplayNameFromVersionInfoSuffixedWithEnvironmentName(isWindows: boolean) {
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy'), path.join(environmentsPath, 'conda', 'envs', 'scipy')],
            default_prefix: path.join(environmentsPath, 'conda', 'envs', 'root'),
            'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        condaService
            .setup(c => c.getInterpreterPath(TypeMoq.It.isAny()))
            .returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
        info.envs.forEach(validPath => {
            const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        });
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: undefined }));
        condaService.setup(c => c.getCondaFile()).returns(() => Promise.resolve('conda'));
        condaService.setup(c => c.getCondaInfo()).returns(() => Promise.resolve(info));
        condaService
            .setup(c => c.getCondaEnvironments(TypeMoq.It.isAny()))
            .returns(() =>
                Promise.resolve([
                    { name: 'base', path: environmentsPath },
                    { name: 'numpy', path: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
                    { name: 'scipy', path: path.join(environmentsPath, 'conda', 'envs', 'scipy') }
                ])
            );
        fileSystem
            .setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((p1: string, p2: string) => (isWindows ? p1 === p2 : p1.toUpperCase() === p2.toUpperCase()));

        const interpreters = await condaProvider.getInterpreters();
        assert.equal(interpreters.length, 2, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
        assert.equal(interpreters[0].type, InterpreterType.Conda, 'Environment not detected as a conda environment');

        const path2 = path.join(info.envs[1], isWindows ? 'python.exe' : path.join('bin', 'python'));
        assert.equal(interpreters[1].path, path2, 'Incorrect path for first env');
        assert.equal(interpreters[1].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
        assert.equal(interpreters[1].type, InterpreterType.Conda, 'Environment not detected as a conda environment');
    }
    test('Must extract display name from version info suffixed with the environment name (oxs/linux)', async () => {
        await extractDisplayNameFromVersionInfoSuffixedWithEnvironmentName(false);
    });
    test('Must extract display name from version info suffixed with the environment name (windows)', async () => {
        await extractDisplayNameFromVersionInfoSuffixedWithEnvironmentName(true);
    });

    async function useDefaultNameIfSysVersionIsInvalid(isWindows: boolean) {
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')],
            default_prefix: '',
            'sys.version': '3.6.1 |Anaonda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        condaService
            .setup(c => c.getInterpreterPath(TypeMoq.It.isAny()))
            .returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
        info.envs.forEach(validPath => {
            const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        });
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: undefined }));

        const interpreters = await parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
        assert.equal(interpreters[0].type, InterpreterType.Conda, 'Environment not detected as a conda environment');
    }
    test('Must use the default display name if sys.version is invalid (non windows)', async () => {
        await useDefaultNameIfSysVersionIsInvalid(false);
    });
    test('Must use the default display name if sys.version is invalid (windows)', async () => {
        await useDefaultNameIfSysVersionIsInvalid(true);
    });

    async function useDefaultNameIfSysVersionIsValidAndSuffixWithEnvironmentName(isWindows: boolean) {
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')],
            default_prefix: '',
            'sys.version': '3.6.1 |Anaonda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: undefined }));
        condaService.setup(c => c.getCondaInfo()).returns(() => Promise.resolve(info));
        condaService
            .setup(c => c.getCondaEnvironments(TypeMoq.It.isAny()))
            .returns(() =>
                Promise.resolve([
                    { name: 'base', path: environmentsPath },
                    { name: 'numpy', path: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
                    { name: 'scipy', path: path.join(environmentsPath, 'conda', 'envs', 'scipy') }
                ])
            );
        condaService
            .setup(c => c.getInterpreterPath(TypeMoq.It.isAny()))
            .returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
        info.envs.forEach(validPath => {
            const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        });
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        fileSystem
            .setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((p1: string, p2: string) => (isWindows ? p1 === p2 : p1.toUpperCase() === p2.toUpperCase()));

        const interpreters = await condaProvider.getInterpreters();
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
        assert.equal(interpreters[0].type, InterpreterType.Conda, 'Environment not detected as a conda environment');
    }
    test('Must use the default display name if sys.version is invalid and suffixed with environment name (non windows)', async () => {
        await useDefaultNameIfSysVersionIsValidAndSuffixWithEnvironmentName(false);
    });
    test('Must use the default display name if sys.version is invalid and suffixed with environment name (windows)', async () => {
        await useDefaultNameIfSysVersionIsValidAndSuffixWithEnvironmentName(false);
    });

    async function useDefaultNameIfSysVersionIsEmpty(isWindows: boolean) {
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')]
        };
        condaService
            .setup(c => c.getInterpreterPath(TypeMoq.It.isAny()))
            .returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
        info.envs.forEach(validPath => {
            const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        });
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: undefined }));

        const interpreters = await parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
        assert.equal(interpreters[0].type, InterpreterType.Conda, 'Environment not detected as a conda environment');
    }

    test('Must use the default display name if sys.version is empty (non windows)', async () => {
        await useDefaultNameIfSysVersionIsEmpty(false);
    });
    test('Must use the default display name if sys.version is empty (windows)', async () => {
        await useDefaultNameIfSysVersionIsEmpty(true);
    });

    async function useDefaultNameIfSysVersionIsEmptyAndSuffixWithEnvironmentName(isWindows: boolean) {
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')]
        };
        condaService
            .setup(c => c.getInterpreterPath(TypeMoq.It.isAny()))
            .returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
        info.envs.forEach(validPath => {
            const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        });
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: undefined }));
        condaService.setup(c => c.getCondaFile()).returns(() => Promise.resolve('conda'));
        condaService.setup(c => c.getCondaInfo()).returns(() => Promise.resolve(info));
        condaService
            .setup(c => c.getCondaEnvironments(TypeMoq.It.isAny()))
            .returns(() =>
                Promise.resolve([
                    { name: 'base', path: environmentsPath },
                    { name: 'numpy', path: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
                    { name: 'scipy', path: path.join(environmentsPath, 'conda', 'envs', 'scipy') }
                ])
            );
        fileSystem
            .setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((p1: string, p2: string) => (isWindows ? p1 === p2 : p1.toUpperCase() === p2.toUpperCase()));

        const interpreters = await condaProvider.getInterpreters();
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
        assert.equal(interpreters[0].type, InterpreterType.Conda, 'Environment not detected as a conda environment');
    }
    test('Must use the default display name if sys.version is empty and suffixed with environment name (non windows)', async () => {
        await useDefaultNameIfSysVersionIsEmptyAndSuffixWithEnvironmentName(false);
    });
    test('Must use the default display name if sys.version is empty and suffixed with environment name (windows)', async () => {
        await useDefaultNameIfSysVersionIsEmptyAndSuffixWithEnvironmentName(true);
    });

    async function includeDefaultPrefixIntoListOfInterpreters(isWindows: boolean) {
        const info = {
            default_prefix: path.join(environmentsPath, 'conda', 'envs', 'numpy')
        };
        condaService
            .setup(c => c.getInterpreterPath(TypeMoq.It.isAny()))
            .returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
        const pythonPath = isWindows ? path.join(info.default_prefix, 'python.exe') : path.join(info.default_prefix, 'bin', 'python');
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: undefined }));

        const interpreters = await parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');

        const path1 = path.join(info.default_prefix, isWindows ? 'python.exe' : path.join('bin', 'python'));
        assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect company display name for first env');
        assert.equal(interpreters[0].type, InterpreterType.Conda, 'Environment not detected as a conda environment');
    }
    test('Must include the default_prefix into the list of interpreters (non windows)', async () => {
        await includeDefaultPrefixIntoListOfInterpreters(false);
    });
    test('Must include the default_prefix into the list of interpreters (windows)', async () => {
        await includeDefaultPrefixIntoListOfInterpreters(true);
    });

    async function excludeInterpretersThatDoNotExistOnFileSystem(isWindows: boolean) {
        const info = {
            envs: [
                path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                path.join(environmentsPath, 'path0', 'one.exe'),
                path.join(environmentsPath, 'path1', 'one.exe'),
                path.join(environmentsPath, 'path2', 'one.exe'),
                path.join(environmentsPath, 'conda', 'envs', 'scipy'),
                path.join(environmentsPath, 'path3', 'three.exe')
            ]
        };
        const validPaths = info.envs.filter((_, index) => index % 2 === 0);
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: undefined }));
        validPaths.forEach(envPath => {
            condaService
                .setup(c => c.getInterpreterPath(TypeMoq.It.isValue(envPath)))
                .returns(environmentPath => {
                    return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
                });
            const pythonPath = isWindows ? path.join(envPath, 'python.exe') : path.join(envPath, 'bin', 'python');
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        });

        const interpreters = await parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);

        assert.equal(interpreters.length, validPaths.length, 'Incorrect number of entries');
        validPaths.forEach((envPath, index) => {
            assert.equal(interpreters[index].envPath!, envPath, 'Incorrect env path');
            const pythonPath = isWindows ? path.join(envPath, 'python.exe') : path.join(envPath, 'bin', 'python');
            assert.equal(interpreters[index].path, pythonPath, 'Incorrect python Path');
        });
    }

    test('Must exclude interpreters that do not exist on disc (non windows)', async () => {
        await excludeInterpretersThatDoNotExistOnFileSystem(false);
    });
    test('Must exclude interpreters that do not exist on disc (windows)', async () => {
        await excludeInterpretersThatDoNotExistOnFileSystem(true);
    });
});
