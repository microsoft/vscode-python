import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IFileSystem } from '../../../../client/common/platform/types';
import { IPersistentStateFactory } from '../../../../client/common/types';
import {
    ICondaService,
    IInterpreterHelper,
    IInterpreterLocatorService,
} from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';
import { AnacondaCompanyName } from '../../../../client/pythonEnvironments/discovery/locators/services/conda';
import { CondaEnvFileService } from '../../../../client/pythonEnvironments/discovery/locators/services/condaEnvFileService';
import { EnvironmentType } from '../../../../client/pythonEnvironments/info';
import { MockState } from '../../../interpreters/mocks';

const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
const environmentsFilePath = path.join(environmentsPath, 'environments.txt');

// tslint:disable-next-line:max-func-body-length
suite('Interpreters from Conda Environments Text File', () => {
    let condaService: TypeMoq.IMock<ICondaService>;
    let interpreterHelper: TypeMoq.IMock<IInterpreterHelper>;
    let condaFileProvider: IInterpreterLocatorService;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const stateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IPersistentStateFactory)))
            .returns(() => stateFactory.object);
        const state = new MockState(undefined);
        stateFactory
            .setup((s) => s.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => state);

        condaService = TypeMoq.Mock.ofType<ICondaService>();
        interpreterHelper = TypeMoq.Mock.ofType<IInterpreterHelper>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        condaFileProvider = new CondaEnvFileService(
            interpreterHelper.object,
            condaService.object,
            fileSystem.object,
            serviceContainer.object,
        );
    });
    test('Must return an empty list if environment file cannot be found', async () => {
        condaService.setup((c) => c.condaEnvironmentsFile).returns(() => undefined);
        interpreterHelper
            .setup((i) => i.getInterpreterInformation(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ version: undefined }));
        const interpreters = await condaFileProvider.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });
    test('Must return an empty list for an empty file', async () => {
        condaService.setup((c) => c.condaEnvironmentsFile).returns(() => environmentsFilePath);
        fileSystem
            .setup((fs) => fs.fileExists(TypeMoq.It.isValue(environmentsFilePath)))
            .returns(() => Promise.resolve(true));
        fileSystem
            .setup((fs) => fs.readFile(TypeMoq.It.isValue(environmentsFilePath)))
            .returns(() => Promise.resolve(''));
        interpreterHelper
            .setup((i) => i.getInterpreterInformation(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ version: undefined }));
        const interpreters = await condaFileProvider.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    });

    async function filterFilesInEnvironmentsFileAndReturnValidItems(isWindows: boolean) {
        const validPaths = [
            path.join(environmentsPath, 'conda', 'envs', 'numpy'),
            path.join(environmentsPath, 'conda', 'envs', 'scipy'),
        ];
        const interpreterPaths = [
            path.join(environmentsPath, 'xyz', 'one'),
            path.join(environmentsPath, 'xyz', 'two'),
            path.join(environmentsPath, 'xyz', 'python.exe'),
        ].concat(validPaths);
        condaService.setup((c) => c.condaEnvironmentsFile).returns(() => environmentsFilePath);
        condaService
            .setup((c) => c.getInterpreterPath(TypeMoq.It.isAny()))
            .returns((environmentPath) =>
                isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python'),
            );
        condaService
            .setup((c) => c.getCondaEnvironments(TypeMoq.It.isAny()))
            .returns(() => {
                const condaEnvironments = validPaths.map((item) => ({
                    path: item,
                    name: path.basename(item),
                }));
                return Promise.resolve(condaEnvironments);
            });
        fileSystem
            .setup((fs) => fs.fileExists(TypeMoq.It.isValue(environmentsFilePath)))
            .returns(() => Promise.resolve(true));
        fileSystem
            .setup((fs) => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((p1: string, p2: string) => (isWindows ? p1 === p2 : p1.toUpperCase() === p2.toUpperCase()));
        validPaths.forEach((validPath) => {
            const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
            fileSystem
                .setup((fs) => fs.fileExists(TypeMoq.It.isValue(pythonPath)))
                .returns(() => Promise.resolve(true));
        });

        fileSystem
            .setup((fs) => fs.readFile(TypeMoq.It.isValue(environmentsFilePath)))
            .returns(() => Promise.resolve(interpreterPaths.join(EOL)));
        interpreterHelper
            .setup((i) => i.getInterpreterInformation(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ version: undefined }));

        const interpreters = await condaFileProvider.getInterpreters();

        const expectedPythonPath = isWindows
            ? path.join(validPaths[0], 'python.exe')
            : path.join(validPaths[0], 'bin', 'python');
        assert.equal(interpreters.length, 2, 'Incorrect number of entries');
        assert.equal(interpreters[0].companyDisplayName, AnacondaCompanyName, 'Incorrect display name');
        assert.equal(interpreters[0].path, expectedPythonPath, 'Incorrect path');
        assert.equal(interpreters[0].envPath, validPaths[0], 'Incorrect envpath');
        assert.equal(interpreters[0].envType, EnvironmentType.Conda, 'Incorrect type');
    }
    test('Must filter files in the list and return valid items (non windows)', async () => {
        await filterFilesInEnvironmentsFileAndReturnValidItems(false);
    });
    test('Must filter files in the list and return valid items (windows)', async () => {
        await filterFilesInEnvironmentsFileAndReturnValidItems(true);
    });
});
