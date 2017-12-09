import * as path from 'path';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import { IPythonSettings, PythonSettings } from '../../common/configSettings';
import { ErrorUtils } from '../../common/errors/errorUtils';
import { ModuleNotInstalledError } from '../../common/errors/moduleNotInstalledError';
import {
    IProcessService,
    IPythonExecutionFactory,
    IPythonExecutionService,
    ObservableExecutionResult,
    SpawnOptions
} from '../../common/process/types';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { IServiceContainer } from '../../ioc/types';
import { NOSETEST_PROVIDER, PYTEST_PROVIDER, UNITTEST_PROVIDER } from './constants';
import { TestProvider } from './types';

export type Options = {
    workspaceFolder: Uri;
    cwd: string;
    args: string[];
    outChannel?: OutputChannel;
    token: CancellationToken;
};

export async function run(serviceContainer: IServiceContainer, testProvider: TestProvider, options: Options): Promise<string> {
    const testExecutablePath = getExecutablePath(testProvider, PythonSettings.getInstance(options.workspaceFolder));
    const moduleName = getTestModuleName(testProvider);
    const spawnOptions = options as SpawnOptions;
    let pythonExecutionServicePromise: Promise<IPythonExecutionService>;
    spawnOptions.mergeStdOutErr = typeof spawnOptions.mergeStdOutErr === 'boolean' ? spawnOptions.mergeStdOutErr : true;

    let promise: Promise<ObservableExecutionResult<string>>;

    if (!testExecutablePath && testProvider === UNITTEST_PROVIDER) {
        // Unit tests have a special way of being executed
        const pythonServiceFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        pythonExecutionServicePromise = pythonServiceFactory.create(options.workspaceFolder);
        promise = pythonExecutionServicePromise.then(executionService => {
            return executionService.execObservable(options.args, { ...spawnOptions });
        });
    } else if (testExecutablePath) {
        const processService = serviceContainer.get<IProcessService>(IProcessService);
        const envVarsService = serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        promise = envVarsService.getEnvironmentVariables(true, options.workspaceFolder).then(executionService => {
            return processService.execObservable(testExecutablePath, options.args, { ...spawnOptions });
        });
    } else {
        const pythonServiceFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        pythonExecutionServicePromise = pythonServiceFactory.create(options.workspaceFolder);
        promise = pythonExecutionServicePromise.then(executionService => {
            return executionService.execModuleObservable(moduleName, options.args, { ...spawnOptions });
        });
    }

    return promise.then(result => {
        return new Promise<string>((resolve, reject) => {
            let stdOut = '';
            let stdErr = '';
            result.out.subscribe(output => {
                stdOut += output.out;
                // If the test runner python module is not installed we'll have something in stderr.
                // Hence track that separately and check at the end.
                if (output.source === 'stderr') {
                    stdErr += output.out;
                }
                if (options.outChannel) {
                    options.outChannel.append(output.out);
                }
            }, reject, async () => {
                // If the test runner python module is not installed we'll have something in stderr.
                if (moduleName && pythonExecutionServicePromise && ErrorUtils.outputHasModuleNotInstalledError(moduleName, stdErr)) {
                    const pythonExecutionService = await pythonExecutionServicePromise;
                    const isInstalled = await pythonExecutionService.isModuleInstalled(moduleName);
                    if (!isInstalled) {
                        return reject(new ModuleNotInstalledError(moduleName));
                    }
                }
                resolve(stdOut);
            });
        });
    });
}

function getExecutablePath(testProvider: TestProvider, settings: IPythonSettings): string | undefined {
    let testRunnerExecutablePath: string | undefined;
    switch (testProvider) {
        case NOSETEST_PROVIDER: {
            testRunnerExecutablePath = settings.unitTest.nosetestPath;
            break;
        }
        case PYTEST_PROVIDER: {
            testRunnerExecutablePath = settings.unitTest.pyTestPath;
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
