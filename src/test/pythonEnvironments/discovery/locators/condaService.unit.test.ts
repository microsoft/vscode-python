import * as assert from 'assert';
import * as path from 'path';
import { parse } from 'semver';
import * as TypeMoq from 'typemoq';

import { DiscoveryVariants } from '../../../../client/common/experiments/groups';
import { FileSystemPaths, FileSystemPathUtils } from '../../../../client/common/platform/fs-paths';
import { IFileSystem, IPlatformService } from '../../../../client/common/platform/types';
import { IProcessService, IProcessServiceFactory } from '../../../../client/common/process/types';
import { IConfigurationService, IExperimentService, IPythonSettings } from '../../../../client/common/types';
import { IServiceContainer } from '../../../../client/ioc/types';
import { CondaService } from '../../../../client/pythonEnvironments/discovery/locators/services/condaService';

suite('Interpreters Conda Service', () => {
    let processService: TypeMoq.IMock<IProcessService>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let condaService: CondaService;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let config: TypeMoq.IMock<IConfigurationService>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let procServiceFactory: TypeMoq.IMock<IProcessServiceFactory>;
    let condaPathSetting: string;
    let experimentService: TypeMoq.IMock<IExperimentService>;
    setup(async () => {
        condaPathSetting = '';
        processService = TypeMoq.Mock.ofType<IProcessService>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        config = TypeMoq.Mock.ofType<IConfigurationService>();
        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        procServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        processService.setup((x: any) => x.then).returns(() => undefined);
        procServiceFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object));

        experimentService = TypeMoq.Mock.ofType<IExperimentService>();
        experimentService
            .setup((exp) => exp.inExperiment(DiscoveryVariants.discoverWithFileWatching))
            .returns(() => Promise.resolve(false));
        experimentService
            .setup((exp) => exp.inExperiment(DiscoveryVariants.discoveryWithoutFileWatching))
            .returns(() => Promise.resolve(false));

        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IProcessServiceFactory), TypeMoq.It.isAny()))
            .returns(() => procServiceFactory.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IPlatformService), TypeMoq.It.isAny()))
            .returns(() => platformService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IFileSystem), TypeMoq.It.isAny()))
            .returns(() => fileSystem.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny()))
            .returns(() => config.object);
        config.setup((c) => c.getSettings(TypeMoq.It.isValue(undefined))).returns(() => settings.object);
        settings.setup((p) => p.condaPath).returns(() => condaPathSetting);
        fileSystem
            .setup((fs) => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((p1, p2) => {
                const utils = FileSystemPathUtils.withDefaults(
                    FileSystemPaths.withDefaults(platformService.object.isWindows),
                );
                return utils.arePathsSame(p1, p2);
            });

        condaService = new CondaService(
            procServiceFactory.object,
            platformService.object,
            fileSystem.object,
            serviceContainer.object,
        );
    });

    test('isAvailable will return true if conda is available', async () => {
        condaService.getCondaFile = () => Promise.resolve('conda');
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: '4.4.4' }));
        const isAvailable = await condaService.isCondaAvailable();
        assert.equal(isAvailable, true);
    });

    test('isAvailable will return false if conda is not available', async () => {
        condaService.getCondaFile = () => Promise.resolve('conda');
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('not found')));
        fileSystem.setup((fs) => fs.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        fileSystem.setup((fs) => fs.search(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
        platformService.setup((p) => p.isWindows).returns(() => false);
        condaService._getCondaInfo = () => Promise.reject(new Error('Not Found'));
        const isAvailable = await condaService.isCondaAvailable();
        assert.equal(isAvailable, false);
    });

    test('Version info from conda process will be returned in getCondaVersion', async () => {
        condaService._getCondaInfo = () => Promise.reject(new Error('Not Found'));
        condaService.getCondaFile = () => Promise.resolve('conda');
        const expectedVersion = parse('4.4.4')!.raw;
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: '4.4.4' }));

        const version = await condaService.getCondaVersion();
        assert.equal(version!.raw, expectedVersion);
    });

    type InterpreterSearchTestParams = {
        pythonPath: string;
        environmentName: string;
        isLinux: boolean;
        expectedCondaPath: string;
    };

    const testsForInterpreter: InterpreterSearchTestParams[] = [
        {
            pythonPath: path.join('users', 'foo', 'envs', 'test1', 'python'),
            environmentName: 'test1',
            isLinux: true,
            expectedCondaPath: path.join('users', 'foo', 'bin', 'conda'),
        },
        {
            pythonPath: path.join('users', 'foo', 'envs', 'test2', 'python'),
            environmentName: 'test2',
            isLinux: true,
            expectedCondaPath: path.join('users', 'foo', 'envs', 'test2', 'conda'),
        },
        {
            pythonPath: path.join('users', 'foo', 'envs', 'test3', 'python'),
            environmentName: 'test3',
            isLinux: false,
            expectedCondaPath: path.join('users', 'foo', 'Scripts', 'conda.exe'),
        },
        {
            pythonPath: path.join('users', 'foo', 'envs', 'test4', 'python'),
            environmentName: 'test4',
            isLinux: false,
            expectedCondaPath: path.join('users', 'foo', 'conda.exe'),
        },
    ];

    testsForInterpreter.forEach((t) => {
        test(`Finds conda.exe for subenvironment ${t.environmentName}`, async () => {
            platformService.setup((p) => p.isLinux).returns(() => t.isLinux);
            platformService.setup((p) => p.isWindows).returns(() => !t.isLinux);
            platformService.setup((p) => p.isMac).returns(() => false);
            fileSystem
                .setup((f) =>
                    f.fileExists(
                        TypeMoq.It.is((p) => {
                            if (p === t.expectedCondaPath) {
                                return true;
                            }
                            return false;
                        }),
                    ),
                )
                .returns(() => Promise.resolve(true));

            const condaFile = await condaService.getCondaFileFromInterpreter(t.pythonPath, t.environmentName);
            assert.equal(condaFile, t.expectedCondaPath);
        });
        test(`Finds conda.exe for different ${t.environmentName}`, async () => {
            platformService.setup((p) => p.isLinux).returns(() => t.isLinux);
            platformService.setup((p) => p.isWindows).returns(() => !t.isLinux);
            platformService.setup((p) => p.isMac).returns(() => false);
            fileSystem
                .setup((f) =>
                    f.fileExists(
                        TypeMoq.It.is((p) => {
                            if (p === t.expectedCondaPath) {
                                return true;
                            }
                            return false;
                        }),
                    ),
                )
                .returns(() => Promise.resolve(true));

            const condaFile = await condaService.getCondaFileFromInterpreter(t.pythonPath, undefined);

            // This should only work if the expectedConda path has the original environment name in it
            if (t.expectedCondaPath.includes(t.environmentName)) {
                assert.equal(condaFile, t.expectedCondaPath);
            } else {
                assert.equal(condaFile, undefined);
            }
        });
    });
});
