// tslint:disable:no-require-imports no-var-requires no-any max-func-body-length
import * as assert from 'assert';
import { expect } from 'chai';
import { EOL } from 'os';
import * as path from 'path';
import { parse, SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { Disposable, EventEmitter } from 'vscode';

import { IWorkspaceService } from '../../../../client/common/application/types';
import { FileSystemPaths, FileSystemPathUtils } from '../../../../client/common/platform/fs-paths';
import { IFileSystem, IPlatformService } from '../../../../client/common/platform/types';
import { IProcessService, IProcessServiceFactory } from '../../../../client/common/process/types';
import { ITerminalActivationCommandProvider } from '../../../../client/common/terminal/types';
import { IConfigurationService, IPersistentStateFactory, IPythonSettings } from '../../../../client/common/types';
import { Architecture } from '../../../../client/common/utils/platform';
import { IInterpreterLocatorService, IInterpreterService } from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';
import { CondaService } from '../../../../client/pythonEnvironments/discovery/locators/services/condaService';
import { InterpreterType, PythonInterpreter } from '../../../../client/pythonEnvironments/discovery/types';
import { MockState } from '../../../interpreters/mocks';

const untildify: (value: string) => string = require('untildify');

const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
const info: PythonInterpreter = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: InterpreterType.Unknown,
    version: new SemVer('0.0.0-alpha'),
    sysPrefix: '',
    sysVersion: ''
};

suite('Interpreters Conda Service', () => {
    let processService: TypeMoq.IMock<IProcessService>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let condaService: CondaService;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let config: TypeMoq.IMock<IConfigurationService>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let registryInterpreterLocatorService: TypeMoq.IMock<IInterpreterLocatorService>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let procServiceFactory: TypeMoq.IMock<IProcessServiceFactory>;
    let persistentStateFactory: TypeMoq.IMock<IPersistentStateFactory>;
    let condaPathSetting: string;
    let disposableRegistry: Disposable[];
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let mockState: MockState;
    let terminalProvider: TypeMoq.IMock<ITerminalActivationCommandProvider>;
    setup(async () => {
        condaPathSetting = '';
        processService = TypeMoq.Mock.ofType<IProcessService>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        registryInterpreterLocatorService = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        config = TypeMoq.Mock.ofType<IConfigurationService>();
        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        procServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        processService.setup((x: any) => x.then).returns(() => undefined);
        procServiceFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object));
        disposableRegistry = [];
        const e = new EventEmitter<void>();
        interpreterService.setup((x) => x.onDidChangeInterpreter).returns(() => e.event);
        resetMockState(undefined);
        persistentStateFactory
            .setup((s) => s.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => mockState);

        terminalProvider = TypeMoq.Mock.ofType<ITerminalActivationCommandProvider>();
        terminalProvider.setup((p) => p.isShellSupported(TypeMoq.It.isAny())).returns(() => true);
        terminalProvider
            .setup((p) => p.getActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(['activate']));
        terminalProvider
            .setup((p) => p.getActivationCommandsForInterpreter!(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(['activate']));

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
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(ITerminalActivationCommandProvider), TypeMoq.It.isAny()))
            .returns(() => terminalProvider.object);
        serviceContainer
            .setup((c) => c.getAll(TypeMoq.It.isValue(ITerminalActivationCommandProvider), TypeMoq.It.isAny()))
            .returns(() => [terminalProvider.object]);
        config.setup((c) => c.getSettings(TypeMoq.It.isValue(undefined))).returns(() => settings.object);
        settings.setup((p) => p.condaPath).returns(() => condaPathSetting);
        fileSystem
            .setup((fs) => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((p1, p2) => {
                const utils = FileSystemPathUtils.withDefaults(
                    FileSystemPaths.withDefaults(platformService.object.isWindows)
                );
                return utils.arePathsSame(p1, p2);
            });

        condaService = new CondaService(
            procServiceFactory.object,
            platformService.object,
            fileSystem.object,
            persistentStateFactory.object,
            config.object,
            disposableRegistry,
            workspaceService.object,
            registryInterpreterLocatorService.object
        );
    });

    function resetMockState(data: any) {
        mockState = new MockState(data);
    }

    async function identifyPythonPathAsCondaEnvironment(
        isWindows: boolean,
        isOsx: boolean,
        isLinux: boolean,
        pythonPath: string
    ) {
        platformService.setup((p) => p.isLinux).returns(() => isLinux);
        platformService.setup((p) => p.isWindows).returns(() => isWindows);
        platformService.setup((p) => p.isMac).returns(() => isOsx);

        const isCondaEnv = await condaService.isCondaEnvironment(pythonPath);
        expect(isCondaEnv).to.be.equal(true, 'Path not identified as a conda path');
    }

    test('Correctly identifies a python path as a conda environment (windows)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'enva', 'python.exe');
        fileSystem
            .setup((f) => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta'))))
            .returns(() => Promise.resolve(true));
        await identifyPythonPathAsCondaEnvironment(true, false, false, pythonPath);
    });

    test('Correctly identifies a python path as a conda environment (linux)', async () => {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        fileSystem
            .setup((f) =>
                f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))
            )
            .returns(() => Promise.resolve(true));
        await identifyPythonPathAsCondaEnvironment(false, false, true, pythonPath);
    });

    test('Correctly identifies a python path as a conda environment (osx)', async () => {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        fileSystem
            .setup((f) =>
                f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))
            )
            .returns(() => Promise.resolve(true));
        await identifyPythonPathAsCondaEnvironment(false, true, false, pythonPath);
    });

    async function identifyPythonPathAsNonCondaEnvironment(
        isWindows: boolean,
        isOsx: boolean,
        isLinux: boolean,
        pythonPath: string
    ) {
        platformService.setup((p) => p.isLinux).returns(() => isLinux);
        platformService.setup((p) => p.isWindows).returns(() => isWindows);
        platformService.setup((p) => p.isMac).returns(() => isOsx);

        fileSystem
            .setup((f) => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta'))))
            .returns(() => Promise.resolve(false));
        fileSystem
            .setup((f) =>
                f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))
            )
            .returns(() => Promise.resolve(false));

        const isCondaEnv = await condaService.isCondaEnvironment(pythonPath);
        expect(isCondaEnv).to.be.equal(false, 'Path incorrectly identified as a conda path');
    }

    test('Correctly identifies a python path as a non-conda environment (windows)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'enva', 'python.exe');
        await identifyPythonPathAsNonCondaEnvironment(true, false, false, pythonPath);
    });

    test('Correctly identifies a python path as a non-conda environment (linux)', async () => {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        await identifyPythonPathAsNonCondaEnvironment(false, false, true, pythonPath);
    });

    test('Correctly identifies a python path as a non-conda environment (osx)', async () => {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        await identifyPythonPathAsNonCondaEnvironment(false, true, false, pythonPath);
    });

    async function checkCondaNameAndPathForCondaEnvironments(
        isWindows: boolean,
        isOsx: boolean,
        isLinux: boolean,
        pythonPath: string,
        condaEnvsPath: string,
        expectedCondaEnv?: { name: string; path: string }
    ) {
        const condaEnvironments = [
            { name: 'One', path: path.join(condaEnvsPath, 'one') },
            { name: 'Three', path: path.join(condaEnvsPath, 'three') },
            { name: 'Seven', path: path.join(condaEnvsPath, 'seven') },
            { name: 'Eight', path: path.join(condaEnvsPath, 'Eight 8') },
            { name: 'nine 9', path: path.join(condaEnvsPath, 'nine 9') }
        ];

        platformService.setup((p) => p.isLinux).returns(() => isLinux);
        platformService.setup((p) => p.isWindows).returns(() => isWindows);
        platformService.setup((p) => p.isMac).returns(() => isOsx);

        resetMockState({ data: condaEnvironments });

        const condaEnv = await condaService.getCondaEnvironment(pythonPath);
        expect(condaEnv).deep.equal(expectedCondaEnv, 'Conda environment not identified');
    }

    test('Correctly retrieves conda environment (windows)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'python.exe');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');

        fileSystem
            .setup((f) => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta'))))
            .returns(() => Promise.resolve(true));
        await checkCondaNameAndPathForCondaEnvironments(true, false, false, pythonPath, condaEnvDir, {
            name: 'One',
            path: path.dirname(pythonPath)
        });
    });

    test('Correctly retrieves conda environment with spaces in env name (windows)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'eight 8', 'python.exe');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');

        fileSystem
            .setup((f) => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta'))))
            .returns(() => Promise.resolve(true));
        await checkCondaNameAndPathForCondaEnvironments(true, false, false, pythonPath, condaEnvDir, {
            name: 'Eight',
            path: path.dirname(pythonPath)
        });
    });

    test('Correctly retrieves conda environment (osx)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'bin', 'python');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');

        fileSystem
            .setup((f) =>
                f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))
            )
            .returns(() => Promise.resolve(true));
        await checkCondaNameAndPathForCondaEnvironments(false, true, false, pythonPath, condaEnvDir, {
            name: 'One',
            path: path.join(path.dirname(pythonPath), '..')
        });
    });

    test('Correctly retrieves conda environment with spaces in env name (osx)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'Eight 8', 'bin', 'python');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');

        fileSystem
            .setup((f) =>
                f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))
            )
            .returns(() => Promise.resolve(true));
        await checkCondaNameAndPathForCondaEnvironments(false, true, false, pythonPath, condaEnvDir, {
            name: 'Eight',
            path: path.join(path.dirname(pythonPath), '..')
        });
    });

    test('Correctly retrieves conda environment (linux)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'bin', 'python');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');

        fileSystem
            .setup((f) =>
                f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))
            )
            .returns(() => Promise.resolve(true));
        await checkCondaNameAndPathForCondaEnvironments(false, false, true, pythonPath, condaEnvDir, {
            name: 'One',
            path: path.join(path.dirname(pythonPath), '..')
        });
    });

    test('Correctly retrieves conda environment with spaces in env name (linux)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'Eight 8', 'bin', 'python');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');

        fileSystem
            .setup((f) =>
                f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))
            )
            .returns(() => Promise.resolve(true));
        await checkCondaNameAndPathForCondaEnvironments(false, false, true, pythonPath, condaEnvDir, {
            name: 'Eight',
            path: path.join(path.dirname(pythonPath), '..')
        });
    });

    test('Ignore cache if environment is not found in the cache (conda env is detected second time round)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'newEnvironment', 'python.exe');
        const condaEnvsPath = path.join('c', 'users', 'xyz', '.conda', 'envs');

        const condaEnvironments = [
            { name: 'One', path: path.join(condaEnvsPath, 'one') },
            { name: 'Three', path: path.join(condaEnvsPath, 'three') },
            { name: 'Seven', path: path.join(condaEnvsPath, 'seven') },
            { name: 'Eight', path: path.join(condaEnvsPath, 'Eight 8') },
            { name: 'nine 9', path: path.join(condaEnvsPath, 'nine 9') }
        ];

        platformService.setup((p) => p.isLinux).returns(() => false);
        platformService.setup((p) => p.isWindows).returns(() => true);
        platformService.setup((p) => p.isMac).returns(() => false);

        fileSystem
            .setup((f) => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta'))))
            .returns(() => Promise.resolve(true));
        resetMockState({ data: condaEnvironments });

        const envList = [
            '# conda environments:',
            '#',
            'base                  *  /Users/donjayamanne/anaconda3',
            'one                      /Users/donjayamanne/anaconda3/envs/one',
            'one two                  /Users/donjayamanne/anaconda3/envs/one two',
            'py27                     /Users/donjayamanne/anaconda3/envs/py27',
            'py36                     /Users/donjayamanne/anaconda3/envs/py36',
            'three                    /Users/donjayamanne/anaconda3/envs/three',
            `newEnvironment           ${path.join(condaEnvsPath, 'newEnvironment')}`
        ];

        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: envList.join(EOL) }));

        const condaEnv = await condaService.getCondaEnvironment(pythonPath);
        expect(condaEnv).deep.equal(
            { name: 'newEnvironment', path: path.dirname(pythonPath) },
            'Conda environment not identified after ignoring cache'
        );
        expect(mockState.data.data).lengthOf(7, 'Incorrect number of items in the cache');
    });

    test('Ignore cache if environment is not found in the cache (cond env is not detected in conda env list)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'newEnvironment', 'python.exe');
        const condaEnvsPath = path.join('c', 'users', 'xyz', '.conda', 'envs');

        const condaEnvironments = [
            { name: 'One', path: path.join(condaEnvsPath, 'one') },
            { name: 'Three', path: path.join(condaEnvsPath, 'three') },
            { name: 'Seven', path: path.join(condaEnvsPath, 'seven') },
            { name: 'Eight', path: path.join(condaEnvsPath, 'Eight 8') },
            { name: 'nine 9', path: path.join(condaEnvsPath, 'nine 9') }
        ];

        platformService.setup((p) => p.isLinux).returns(() => false);
        platformService.setup((p) => p.isWindows).returns(() => true);
        platformService.setup((p) => p.isMac).returns(() => false);

        fileSystem
            .setup((f) => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta'))))
            .returns(() => Promise.resolve(true));
        resetMockState({ data: condaEnvironments });

        const envList = [
            '# conda environments:',
            '#',
            'base                  *  /Users/donjayamanne/anaconda3',
            'one                      /Users/donjayamanne/anaconda3/envs/one',
            'one two                  /Users/donjayamanne/anaconda3/envs/one two',
            'py27                     /Users/donjayamanne/anaconda3/envs/py27',
            'py36                     /Users/donjayamanne/anaconda3/envs/py36',
            'three                    /Users/donjayamanne/anaconda3/envs/three'
        ];

        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: envList.join(EOL) }));

        const condaEnv = await condaService.getCondaEnvironment(pythonPath);
        expect(condaEnv).deep.equal(undefined, 'Conda environment incorrectly identified after ignoring cache');
        expect(mockState.data.data).lengthOf(6, 'Incorrect number of items in the cache');
    });

    test('Must use Conda env from Registry to locate conda.exe', async () => {
        const condaPythonExePath = path.join('dumyPath', 'environments', 'conda', 'Scripts', 'python.exe');
        const registryInterpreters: PythonInterpreter[] = [
            {
                displayName: 'One',
                path: path.join(environmentsPath, 'path1', 'one.exe'),
                companyDisplayName: 'One 1',
                version: new SemVer('1.0.0'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Anaconda',
                path: condaPythonExePath,
                companyDisplayName: 'Two 2',
                version: new SemVer('1.11.0'),
                type: InterpreterType.Conda
            },
            {
                displayName: 'Three',
                path: path.join(environmentsPath, 'path2', 'one.exe'),
                companyDisplayName: 'Three 3',
                version: new SemVer('2.10.1'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Seven',
                path: path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                companyDisplayName: 'Continuum Analytics, Inc.',
                type: InterpreterType.Unknown
            }
        ].map((item) => {
            return { ...info, ...item };
        });
        const condaInterpreterIndex = registryInterpreters.findIndex((i) => i.displayName === 'Anaconda');
        const expectedCodnaPath = path.join(
            path.dirname(registryInterpreters[condaInterpreterIndex].path),
            'conda.exe'
        );
        platformService.setup((p) => p.isWindows).returns(() => true);
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('Not Found')));
        registryInterpreterLocatorService
            .setup((r) => r.getInterpreters(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(registryInterpreters));
        fileSystem
            .setup((fs) => fs.fileExists(TypeMoq.It.isAny()))
            .returns((file: string) => Promise.resolve(file === expectedCodnaPath));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, expectedCodnaPath, 'Failed to identify conda.exe');
    });

    test('Must use Conda env from Registry to latest version of locate conda.exe', async () => {
        const condaPythonExePath = path.join('dumyPath', 'environments');
        const registryInterpreters: PythonInterpreter[] = [
            {
                displayName: 'One',
                path: path.join(environmentsPath, 'path1', 'one.exe'),
                companyDisplayName: 'One 1',
                version: new SemVer('1.0.0'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Anaconda',
                path: path.join(condaPythonExePath, 'conda1', 'Scripts', 'python.exe'),
                companyDisplayName: 'Two 1',
                version: new SemVer('1.11.0'),
                type: InterpreterType.Conda
            },
            {
                displayName: 'Anaconda',
                path: path.join(condaPythonExePath, 'conda211', 'Scripts', 'python.exe'),
                companyDisplayName: 'Two 2.11',
                version: new SemVer('2.11.0'),
                type: InterpreterType.Conda
            },
            {
                displayName: 'Anaconda',
                path: path.join(condaPythonExePath, 'conda231', 'Scripts', 'python.exe'),
                companyDisplayName: 'Two 2.31',
                version: new SemVer('2.31.0'),
                type: InterpreterType.Conda
            },
            {
                displayName: 'Anaconda',
                path: path.join(condaPythonExePath, 'conda221', 'Scripts', 'python.exe'),
                companyDisplayName: 'Two 2.21',
                version: new SemVer('2.21.0'),
                type: InterpreterType.Conda
            },
            {
                displayName: 'Three',
                path: path.join(environmentsPath, 'path2', 'one.exe'),
                companyDisplayName: 'Three 3',
                version: new SemVer('2.10.1'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Seven',
                path: path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                companyDisplayName: 'Continuum Analytics, Inc.',
                type: InterpreterType.Unknown
            }
        ].map((item) => {
            return { ...info, ...item };
        });
        const indexOfLatestVersion = 3;
        const expectedCodnaPath = path.join(path.dirname(registryInterpreters[indexOfLatestVersion].path), 'conda.exe');
        platformService.setup((p) => p.isWindows).returns(() => true);
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('Not Found')));
        registryInterpreterLocatorService
            .setup((r) => r.getInterpreters(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(registryInterpreters));
        fileSystem
            .setup((fs) => fs.fileExists(TypeMoq.It.isAny()))
            .returns((file: string) => Promise.resolve(file === expectedCodnaPath));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, expectedCodnaPath, 'Failed to identify conda.exe');
    });

    test("Must use 'conda' if conda.exe cannot be located using registry entries", async () => {
        const condaPythonExePath = path.join('dumyPath', 'environments');
        const registryInterpreters: PythonInterpreter[] = [
            {
                displayName: 'One',
                path: path.join(environmentsPath, 'path1', 'one.exe'),
                companyDisplayName: 'One 1',
                version: new SemVer('1.0.0'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Anaconda',
                path: path.join(condaPythonExePath, 'conda1', 'Scripts', 'python.exe'),
                companyDisplayName: 'Two 1',
                version: new SemVer('1.11.0'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Anaconda',
                path: path.join(condaPythonExePath, 'conda211', 'Scripts', 'python.exe'),
                companyDisplayName: 'Two 2.11',
                version: new SemVer('2.11.0'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Anaconda',
                path: path.join(condaPythonExePath, 'conda231', 'Scripts', 'python.exe'),
                companyDisplayName: 'Two 2.31',
                version: new SemVer('2.31.0'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Anaconda',
                path: path.join(condaPythonExePath, 'conda221', 'Scripts', 'python.exe'),
                companyDisplayName: 'Two 2.21',
                version: new SemVer('2.21.0'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Three',
                path: path.join(environmentsPath, 'path2', 'one.exe'),
                companyDisplayName: 'Three 3',
                version: new SemVer('2.10.1'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Seven',
                path: path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                companyDisplayName: 'Continuum Analytics, Inc.',
                type: InterpreterType.Unknown
            }
        ].map((item) => {
            return { ...info, ...item };
        });
        platformService.setup((p) => p.isWindows).returns(() => true);
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('Not Found')));
        registryInterpreterLocatorService
            .setup((r) => r.getInterpreters(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(registryInterpreters));
        fileSystem.setup((fs) => fs.search(TypeMoq.It.isAnyString())).returns(async () => []);
        fileSystem.setup((fs) => fs.fileExists(TypeMoq.It.isAny())).returns((_file: string) => Promise.resolve(false));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify conda.exe');
    });

    test('Get conda file from default/known locations', async () => {
        const expected = 'C:/ProgramData/Miniconda2/Scripts/conda.exe';

        platformService.setup((p) => p.isWindows).returns(() => true);

        fileSystem.setup((f) => f.search(TypeMoq.It.isAnyString())).returns(() => Promise.resolve([expected]));
        const CondaServiceForTesting = class extends CondaService {
            public async isCondaInCurrentPath() {
                return false;
            }
        };
        const condaSrv = new CondaServiceForTesting(
            procServiceFactory.object,
            platformService.object,
            fileSystem.object,
            persistentStateFactory.object,
            config.object,
            disposableRegistry,
            workspaceService.object
        );

        const result = await condaSrv.getCondaFile();
        expect(result).is.equal(expected);
    });

    test("Must use 'python.condaPath' setting if set", async () => {
        condaPathSetting = 'spam-spam-conda-spam-spam';
        // We ensure that conda would otherwise be found.
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version'])))
            .returns(() => Promise.resolve({ stdout: 'xyz' }))
            .verifiable(TypeMoq.Times.never());

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, 'spam-spam-conda-spam-spam', 'Failed to identify conda.exe');

        // We should not try to call other unwanted methods.
        processService.verifyAll();
        registryInterpreterLocatorService.verify((r) => r.getInterpreters(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });

    test("Must use 'conda' if is available in the current path", async () => {
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version'])))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify conda.exe');

        // We should not try to call other unwanted methods.
        registryInterpreterLocatorService.verify((r) => r.getInterpreters(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });

    test('Must invoke process only once to check if conda is in the current path', async () => {
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version'])))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify conda.exe');
        processService.verify(
            (p) => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.once()
        );

        // We should not try to call other unwanted methods.
        registryInterpreterLocatorService.verify((r) => r.getInterpreters(TypeMoq.It.isAny()), TypeMoq.Times.never());

        await condaService.getCondaFile();
        processService.verify(
            (p) => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.once()
        );
    });

    [
        '~/anaconda/bin/conda',
        '~/miniconda/bin/conda',
        '~/anaconda2/bin/conda',
        '~/miniconda2/bin/conda',
        '~/anaconda3/bin/conda',
        '~/miniconda3/bin/conda'
    ].forEach((knownLocation) => {
        test(`Must return conda path from known location '${knownLocation}' (non windows)`, async () => {
            const expectedCondaLocation = untildify(knownLocation);
            platformService.setup((p) => p.isWindows).returns(() => false);
            processService
                .setup((p) =>
                    p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())
                )
                .returns(() => Promise.reject(new Error('Not Found')));
            fileSystem
                .setup((fs) => fs.search(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve([expectedCondaLocation]));
            fileSystem
                .setup((fs) => fs.fileExists(TypeMoq.It.isValue(expectedCondaLocation)))
                .returns(() => Promise.resolve(true));

            const condaExe = await condaService.getCondaFile();
            assert.equal(condaExe, expectedCondaLocation, 'Failed to identify');
        });
    });

    test("Must return 'conda' if conda could not be found in known locations", async () => {
        platformService.setup((p) => p.isWindows).returns(() => false);
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('Not Found')));
        fileSystem.setup((fs) => fs.search(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
        fileSystem.setup((fs) => fs.fileExists(TypeMoq.It.isAny())).returns((_file: string) => Promise.resolve(false));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify');
    });

    test('Correctly identify interpreter location relative to entironment path (non windows)', async () => {
        const environmentPath = path.join('a', 'b', 'c');
        platformService.setup((p) => p.isWindows).returns(() => false);
        const pythonPath = condaService.getInterpreterPath(environmentPath);
        assert.equal(pythonPath, path.join(environmentPath, 'bin', 'python'), 'Incorrect path');
    });

    test('Correctly identify interpreter location relative to entironment path (windows)', async () => {
        const environmentPath = path.join('a', 'b', 'c');
        platformService.setup((p) => p.isWindows).returns(() => true);
        const pythonPath = condaService.getInterpreterPath(environmentPath);
        assert.equal(pythonPath, path.join(environmentPath, 'python.exe'), 'Incorrect path');
    });

    test('Returns condaInfo when conda exists', async () => {
        const expectedInfo = {
            envs: [
                path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                path.join(environmentsPath, 'conda', 'envs', 'scipy')
            ],
            default_prefix: '',
            'sys.version':
                '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService
            .setup((p) =>
                p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['info', '--json']), TypeMoq.It.isAny())
            )
            .returns(() => Promise.resolve({ stdout: JSON.stringify(expectedInfo) }));

        const condaInfo = await condaService.getCondaInfo();
        assert.deepEqual(condaInfo, expectedInfo, 'Conda info does not match');
    });

    test("Returns undefined if there's and error in getting the info", async () => {
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService
            .setup((p) =>
                p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['info', '--json']), TypeMoq.It.isAny())
            )
            .returns(() => Promise.reject(new Error('unknown')));

        const condaInfo = await condaService.getCondaInfo();
        assert.equal(condaInfo, undefined, 'Conda info does not match');
    });

    test('Returns conda environments when conda exists', async () => {
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: '' }));
        const environments = await condaService.getCondaEnvironments(true);
        assert.equal(environments, undefined, 'Conda environments do not match');
    });

    test('Logs information message when conda does not exist', async () => {
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('Not Found')));
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('Not Found')));
        const environments = await condaService.getCondaEnvironments(true);
        assert.equal(environments, undefined, 'Conda environments do not match');
    });

    test('Returns cached conda environments', async () => {
        resetMockState({ data: 'CachedInfo' });

        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: '' }));
        const environments = await condaService.getCondaEnvironments(false);
        assert.equal(environments, 'CachedInfo', 'Conda environments do not match');
    });

    test('Subsequent list of environments will be retrieved from cache', async () => {
        const envList = [
            '# conda environments:',
            '#',
            'base                  *  /Users/donjayamanne/anaconda3',
            'one                      /Users/donjayamanne/anaconda3/envs/one',
            'one two                  /Users/donjayamanne/anaconda3/envs/one two',
            'py27                     /Users/donjayamanne/anaconda3/envs/py27',
            'py36                     /Users/donjayamanne/anaconda3/envs/py36',
            'three                    /Users/donjayamanne/anaconda3/envs/three'
        ];

        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: envList.join(EOL) }));
        const environments = await condaService.getCondaEnvironments(false);
        expect(environments).lengthOf(6, 'Incorrect number of environments');
        expect(mockState.data.data).lengthOf(6, 'Incorrect number of environments in cache');

        mockState.data.data = [];
        const environmentsFetchedAgain = await condaService.getCondaEnvironments(false);
        expect(environmentsFetchedAgain).lengthOf(0, 'Incorrect number of environments fetched from cache');
    });

    test("Returns undefined if there's and error in getting the info", async () => {
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService
            .setup((p) =>
                p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['info', '--json']), TypeMoq.It.isAny())
            )
            .returns(() => Promise.reject(new Error('unknown')));

        const condaInfo = await condaService.getCondaInfo();
        assert.equal(condaInfo, undefined, 'Conda info does not match');
    });

    test('Must use Conda env from Registry to locate conda.exe', async () => {
        const condaPythonExePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'src',
            'test',
            'pythonFiles',
            'environments',
            'conda',
            'Scripts',
            'python.exe'
        );
        const registryInterpreters: PythonInterpreter[] = [
            {
                displayName: 'One',
                path: path.join(environmentsPath, 'path1', 'one.exe'),
                companyDisplayName: 'One 1',
                version: new SemVer('1.0.0'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Anaconda',
                path: condaPythonExePath,
                companyDisplayName: 'Two 2',
                version: new SemVer('1.11.0'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Three',
                path: path.join(environmentsPath, 'path2', 'one.exe'),
                companyDisplayName: 'Three 3',
                version: new SemVer('2.10.1'),
                type: InterpreterType.Unknown
            },
            {
                displayName: 'Seven',
                path: path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                companyDisplayName: 'Continuum Analytics, Inc.',
                type: InterpreterType.Unknown
            }
        ].map((item) => {
            return { ...info, ...item };
        });

        const expectedCodaExe = path.join(path.dirname(condaPythonExePath), 'conda.exe');

        platformService.setup((p) => p.isWindows).returns(() => true);
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('Not Found')));
        fileSystem
            .setup((fs) => fs.fileExists(TypeMoq.It.isValue(expectedCodaExe)))
            .returns(() => Promise.resolve(true));
        registryInterpreterLocatorService
            .setup((r) => r.getInterpreters(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(registryInterpreters));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, expectedCodaExe, 'Failed to identify conda.exe');
    });

    test('isAvailable will return true if conda is available', async () => {
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
        condaService.getCondaInfo = () => Promise.reject('Not Found');
        const isAvailable = await condaService.isCondaAvailable();
        assert.equal(isAvailable, false);
    });

    test('Version info from conda process will be returned in getCondaVersion', async () => {
        condaService.getCondaInfo = () => Promise.reject('Not Found');
        condaService.getCondaFile = () => Promise.resolve('conda');
        const expectedVersion = parse('4.4.4')!.raw;
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: '4.4.4' }));

        const version = await condaService.getCondaVersion();
        assert.equal(version!.raw, expectedVersion);
    });

    test('isCondaInCurrentPath will return true if conda is available', async () => {
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'xyz' }));
        const isAvailable = await condaService.isCondaInCurrentPath();
        assert.equal(isAvailable, true);
    });

    test('isCondaInCurrentPath will return false if conda is not available', async () => {
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('not found')));
        fileSystem.setup((fs) => fs.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        platformService.setup((p) => p.isWindows).returns(() => false);

        const isAvailable = await condaService.isCondaInCurrentPath();
        assert.equal(isAvailable, false);
    });

    async function testFailureOfGettingCondaEnvironments(
        isWindows: boolean,
        isOsx: boolean,
        isLinux: boolean,
        pythonPath: string
    ) {
        platformService.setup((p) => p.isLinux).returns(() => isLinux);
        platformService.setup((p) => p.isWindows).returns(() => isWindows);
        platformService.setup((p) => p.isMac).returns(() => isOsx);

        resetMockState({ data: undefined });
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'some value' }));
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny()))
            .returns(() => Promise.reject(new Error('Failed')));
        const condaEnv = await condaService.getCondaEnvironment(pythonPath);
        expect(condaEnv).to.be.equal(undefined, 'Conda should be undefined');
    }
    test('Fails to identify an environment as a conda env (windows)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'python.exe');
        fileSystem
            .setup((f) => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta'))))
            .returns(() => Promise.resolve(true));
        await testFailureOfGettingCondaEnvironments(true, false, false, pythonPath);
    });
    test('Fails to identify an environment as a conda env (linux)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'python');
        fileSystem
            .setup((f) => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta'))))
            .returns(() => Promise.resolve(true));
        await testFailureOfGettingCondaEnvironments(false, false, true, pythonPath);
    });
    test('Fails to identify an environment as a conda env (osx)', async () => {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'python');
        fileSystem
            .setup((f) => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta'))))
            .returns(() => Promise.resolve(true));
        await testFailureOfGettingCondaEnvironments(false, true, false, pythonPath);
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
            expectedCondaPath: path.join('users', 'foo', 'bin', 'conda')
        },
        {
            pythonPath: path.join('users', 'foo', 'envs', 'test2', 'python'),
            environmentName: 'test2',
            isLinux: true,
            expectedCondaPath: path.join('users', 'foo', 'envs', 'test2', 'conda')
        },
        {
            pythonPath: path.join('users', 'foo', 'envs', 'test3', 'python'),
            environmentName: 'test3',
            isLinux: false,
            expectedCondaPath: path.join('users', 'foo', 'Scripts', 'conda.exe')
        },
        {
            pythonPath: path.join('users', 'foo', 'envs', 'test4', 'python'),
            environmentName: 'test4',
            isLinux: false,
            expectedCondaPath: path.join('users', 'foo', 'conda.exe')
        }
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
                        })
                    )
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
                        })
                    )
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
