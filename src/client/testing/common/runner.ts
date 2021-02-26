import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ErrorUtils } from '../../common/errors/errorUtils';
import { ModuleNotInstalledError } from '../../common/errors/moduleNotInstalledError';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    IPythonToolExecutionService,
    ObservableExecutionResult,
    SpawnOptions,
} from '../../common/process/types';
import { ExecutionInfo, IConfigurationService, IPythonSettings } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { TestProvider } from '../types';
import { NOSETEST_PROVIDER, PYTEST_PROVIDER, UNITTEST_PROVIDER } from './constants';
import { ITestRunner, ITestsHelper, Options } from './types';
export { Options } from './types';

@injectable()
export class TestRunner implements ITestRunner {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {}
    public run(testProvider: TestProvider, options: Options): Promise<string> {
        return run(this.serviceContainer, testProvider, options);
    }
}

export async function run(
    serviceContainer: IServiceContainer,
    testProvider: TestProvider,
    options: Options,
): Promise<string> {
    const testExecutablePath = getExecutablePath(
        testProvider,
        serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(options.workspaceFolder),
    );
    const moduleName = getTestModuleName(testProvider);
    const spawnOptions = options as SpawnOptions;
    let pythonExecutionServicePromise: Promise<IPythonExecutionService>;
    spawnOptions.mergeStdOutErr = typeof spawnOptions.mergeStdOutErr === 'boolean' ? spawnOptions.mergeStdOutErr : true;

    let promise: Promise<ObservableExecutionResult<string>>;

    // Since conda 4.4.0 we have found that running python code needs the environment activated.
    // So if running an executable, there's no way we can activate, if its a module, then activate and run the module.
    const testHelper = serviceContainer.get<ITestsHelper>(ITestsHelper);
    const executionInfo: ExecutionInfo = {
        execPath: testExecutablePath,
        args: options.args,
        moduleName: testExecutablePath && testExecutablePath.length > 0 ? undefined : moduleName,
        product: testHelper.parseProduct(testProvider),
    };

    if (testProvider === UNITTEST_PROVIDER) {
        promise = serviceContainer
            .get<IPythonExecutionFactory>(IPythonExecutionFactory)
            .createActivatedEnvironment({ resource: options.workspaceFolder })
            .then((executionService) => executionService.execObservable(options.args, { ...spawnOptions }));
    } else if (typeof executionInfo.moduleName === 'string' && executionInfo.moduleName.length > 0) {
        pythonExecutionServicePromise = serviceContainer
            .get<IPythonExecutionFactory>(IPythonExecutionFactory)
            .createActivatedEnvironment({ resource: options.workspaceFolder });
        promise = pythonExecutionServicePromise.then((executionService) =>
            executionService.execModuleObservable(executionInfo.moduleName!, executionInfo.args, options),
        );
    } else {
        const pythonToolsExecutionService = serviceContainer.get<IPythonToolExecutionService>(
            IPythonToolExecutionService,
        );
        promise = pythonToolsExecutionService.execObservable(executionInfo, spawnOptions, options.workspaceFolder);
    }

    return promise.then((result) => {
        return new Promise<string>((resolve, reject) => {
            let stdOut = '';
            let stdErr = '';
            result.out.subscribe(
                (output) => {
                    stdOut += output.out;
                    // If the test runner python module is not installed we'll have something in stderr.
                    // Hence track that separately and check at the end.
                    if (output.source === 'stderr') {
                        stdErr += output.out;
                    }
                    if (options.outChannel) {
                        options.outChannel.append(output.out);
                    }
                },
                reject,
                async () => {
                    // If the test runner python module is not installed we'll have something in stderr.
                    if (
                        moduleName &&
                        pythonExecutionServicePromise &&
                        ErrorUtils.outputHasModuleNotInstalledError(moduleName, stdErr)
                    ) {
                        const pythonExecutionService = await pythonExecutionServicePromise;
                        const isInstalled = await pythonExecutionService.isModuleInstalled(moduleName);
                        if (!isInstalled) {
                            return reject(new ModuleNotInstalledError(moduleName));
                        }
                    }
                    resolve(stdOut);
                },
            );
        });
    });
}

function getExecutablePath(testProvider: TestProvider, settings: IPythonSettings): string | undefined {
    let testRunnerExecutablePath: string | undefined;
    switch (testProvider) {
        case NOSETEST_PROVIDER: {
            testRunnerExecutablePath = settings.testing.nosetestPath;
            break;
        }
        case PYTEST_PROVIDER: {
            testRunnerExecutablePath = settings.testing.pytestPath;
            break;
        }
        default: {
            return undefined;
        }
    }
    return path.basename(testRunnerExecutablePath) === testRunnerExecutablePath ? undefined : testRunnerExecutablePath;
}
function getTestModuleName(testProvider: TestProvider) {
    switch (testProvider) {
        case NOSETEST_PROVIDER: {
            return 'nose';
        }
        case PYTEST_PROVIDER: {
            return 'pytest';
        }
        case UNITTEST_PROVIDER: {
            return 'unittest';
        }
        default: {
            throw new Error(`Test provider '${testProvider}' not supported`);
        }
    }
}
