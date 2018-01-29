import * as assert from 'assert';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IProcessService } from '../../client/common/process/types';
import { ILogger } from '../../client/common/types';
import { IInterpreterLocatorService, InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { CondaService, KNOWN_CONDA_LOCATIONS } from '../../client/interpreter/locators/services/condaService';
// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');

// tslint:disable-next-line:max-func-body-length
suite('Interpreters Conda Service', () => {
    let logger: TypeMoq.IMock<ILogger>;
    let processService: TypeMoq.IMock<IProcessService>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let condaService: CondaService;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let registryInterpreterLocatorService: TypeMoq.IMock<IInterpreterLocatorService>;

    setup(async () => {
        logger = TypeMoq.Mock.ofType<ILogger>();
        processService = TypeMoq.Mock.ofType<IProcessService>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        registryInterpreterLocatorService = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        condaService = new CondaService(processService.object, platformService.object, logger.object, fileSystem.object, registryInterpreterLocatorService.object);
    });

    test('Must use Conda env from Registry to locate conda.exe', async () => {
        const condaPythonExePath = path.join('dumyPath', 'environments', 'conda', 'Scripts', 'python.exe');
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: condaPythonExePath, companyDisplayName: 'Two 2', version: '1.11.0', type: InterpreterType.Unknown },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1', type: InterpreterType.Unknown },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.', type: InterpreterType.Unknown }
        ];
        const condaInterpreterIndex = registryInterpreters.findIndex(i => i.displayName === 'Anaconda');
        const expectedCodnaPath = path.join(path.dirname(registryInterpreters[condaInterpreterIndex].path), 'conda.exe');
        platformService.setup(p => p.isWindows).returns(() => true);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        registryInterpreterLocatorService.setup(r => r.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(registryInterpreters));
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isAny())).returns((file: string) => Promise.resolve(file === expectedCodnaPath));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, expectedCodnaPath, 'Failed to identify conda.exe');
    });

    test('Must use Conda env from Registry to latest version of locate conda.exe', async () => {
        const condaPythonExePath = path.join('dumyPath', 'environments');
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda1', 'Scripts', 'python.exe'), companyDisplayName: 'Two 1', version: '1.11.0', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda211', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.11', version: '2.11.0', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda231', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.31', version: '2.31.0', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda221', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.21', version: '2.21.0', type: InterpreterType.Unknown },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1', type: InterpreterType.Unknown },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.', type: InterpreterType.Unknown }
        ];
        const indexOfLatestVersion = 3;
        const expectedCodnaPath = path.join(path.dirname(registryInterpreters[indexOfLatestVersion].path), 'conda.exe');
        platformService.setup(p => p.isWindows).returns(() => true);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        registryInterpreterLocatorService.setup(r => r.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(registryInterpreters));
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isAny())).returns((file: string) => Promise.resolve(file === expectedCodnaPath));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, expectedCodnaPath, 'Failed to identify conda.exe');
    });

    test('Must use \'conda\' if conda.exe cannot be located using registry entries', async () => {
        const condaPythonExePath = path.join('dumyPath', 'environments');
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda1', 'Scripts', 'python.exe'), companyDisplayName: 'Two 1', version: '1.11.0', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda211', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.11', version: '2.11.0', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda231', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.31', version: '2.31.0', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda221', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.21', version: '2.21.0', type: InterpreterType.Unknown },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1', type: InterpreterType.Unknown },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.', type: InterpreterType.Unknown }
        ];
        platformService.setup(p => p.isWindows).returns(() => true);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        registryInterpreterLocatorService.setup(r => r.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(registryInterpreters));
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isAny())).returns((file: string) => Promise.resolve(false));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify conda.exe');
    });

    test('Must use \'conda\' if is available in the current path', async () => {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']))).returns(() => Promise.resolve({ stdout: 'xyz' }));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify conda.exe');

        // We should not try to call other unwanted methods.
        platformService.verify(p => p.isWindows, TypeMoq.Times.never());
        registryInterpreterLocatorService.verify(r => r.getInterpreters(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });

    test('Must invoke process only once to check if conda is in the current path', async () => {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']))).returns(() => Promise.resolve({ stdout: 'xyz' }));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify conda.exe');
        processService.verify(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());

        // We should not try to call other unwanted methods.
        platformService.verify(p => p.isWindows, TypeMoq.Times.never());
        registryInterpreterLocatorService.verify(r => r.getInterpreters(TypeMoq.It.isAny()), TypeMoq.Times.never());

        await condaService.getCondaFile();
        processService.verify(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });

    KNOWN_CONDA_LOCATIONS.forEach(knownLocation => {
        test(`Must return conda path from known location '${knownLocation}' (non windows)`, async () => {
            const expectedCondaLocation = untildify(knownLocation);
            platformService.setup(p => p.isWindows).returns(() => false);
            processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
            fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isAny())).returns((file: string) => Promise.resolve(file === expectedCondaLocation));

            const condaExe = await condaService.getCondaFile();
            assert.equal(condaExe, expectedCondaLocation, 'Failed to identify');
        });
    });

    test('Must return \'conda\' if conda could not be found in known locations', async () => {
        platformService.setup(p => p.isWindows).returns(() => false);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isAny())).returns((file: string) => Promise.resolve(false));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify');
    });

    test('Correctly identify interpreter location relative to entironment path (non windows)', async () => {
        const environmentPath = path.join('a', 'b', 'c');
        platformService.setup(p => p.isWindows).returns(() => false);
        const pythonPath = condaService.getInterpreterPath(environmentPath);
        assert.equal(pythonPath, path.join(environmentPath, 'bin', 'python'), 'Incorrect path');
    });

    test('Correctly identify interpreter location relative to entironment path (windows)', async () => {
        const environmentPath = path.join('a', 'b', 'c');
        platformService.setup(p => p.isWindows).returns(() => true);
        const pythonPath = condaService.getInterpreterPath(environmentPath);
        assert.equal(pythonPath, path.join(environmentPath, 'python.exe'), 'Incorrect path');
    });

    test('Returns condaInfo when conda exists', async () => {
        const info = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy'),
            path.join(environmentsPath, 'conda', 'envs', 'scipy')],
            default_prefix: '',
            'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['info', '--json']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: JSON.stringify(info) }));

        const condaInfo = await condaService.getCondaInfo();
        assert.deepEqual(condaInfo, info, 'Conda info does not match');
    });

    test('Returns undefined if there\'s and error in getting the info', async () => {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['info', '--json']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('unknown')));

        const condaInfo = await condaService.getCondaInfo();
        assert.equal(condaInfo, undefined, 'Conda info does not match');
        logger.verify(l => l.logError(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });

    test('Returns conda environments when conda exists', async () => {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: '' }));
        const environments = await condaService.getCondaEnvironments();
        assert.equal(environments, undefined, 'Conda environments do not match');
    });

    test('Returns undefined if there\'s and error in getting the info', async () => {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['info', '--json']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('unknown')));

        const condaInfo = await condaService.getCondaInfo();
        assert.equal(condaInfo, undefined, 'Conda info does not match');
        logger.verify(l => l.logError(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });

    test('Must use Conda env from Registry to locate conda.exe', async () => {
        const condaPythonExePath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments', 'conda', 'Scripts', 'python.exe');
        const registryInterpreters: PythonInterpreter[] = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1', type: InterpreterType.Unknown },
            { displayName: 'Anaconda', path: condaPythonExePath, companyDisplayName: 'Two 2', version: '1.11.0', type: InterpreterType.Unknown },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1', type: InterpreterType.Unknown },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.', type: InterpreterType.Unknown }
        ];

        const expectedCodaExe = path.join(path.dirname(condaPythonExePath), 'conda.exe');

        platformService.setup(p => p.isWindows).returns(() => true);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(expectedCodaExe))).returns(() => Promise.resolve(true));
        registryInterpreterLocatorService.setup(r => r.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(registryInterpreters));

        const condaExe = await condaService.getCondaFile();
        assert.equal(condaExe, expectedCodaExe, 'Failed to identify conda.exe');
    });

    test('isAvailable will return true if conda is available', async () => {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        const isAvailable = await condaService.isCondaAvailable();
        assert.equal(isAvailable, true);
    });

    test('isAvailable will return false if conda is not available', async () => {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('not found')));
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        platformService.setup(p => p.isWindows).returns(() => false);

        const isAvailable = await condaService.isCondaAvailable();
        assert.equal(isAvailable, false);
    });

    test('Version info from conda process will be returned in getCondaVersion', async () => {
        const expectedVersion = new Date().toString();
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: expectedVersion }));

        const version = await condaService.getCondaVersion();
        assert.equal(version, expectedVersion);
    });

    test('isCondaInCurrentPath will return true if conda is available', async () => {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        const isAvailable = await condaService.isCondaInCurrentPath();
        assert.equal(isAvailable, true);
    });

    test('isCondaInCurrentPath will return false if conda is not available', async () => {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('not found')));
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        platformService.setup(p => p.isWindows).returns(() => false);

        const isAvailable = await condaService.isCondaInCurrentPath();
        assert.equal(isAvailable, false);
    });

});
