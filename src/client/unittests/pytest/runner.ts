'use strict';
import * as path from 'path';
import { createTemporaryFile } from '../../common/helpers';
import { IServiceContainer } from '../../ioc/types';
import { Options, run } from '../common/runner';
import { ITestDebugLauncher, ITestResultsService, TestRunOptions, Tests } from '../common/types';
import { PassCalculationFormulae, updateResultsFromXmlLogFile } from '../common/xUnitParser';

export function runTest(serviceContainer: IServiceContainer, testResultsService: ITestResultsService, options: TestRunOptions): Promise<Tests> {
    let testPaths: string[] = [];
    if (options.testsToRun && options.testsToRun.testFolder) {
        testPaths = testPaths.concat(options.testsToRun.testFolder.map(f => f.nameToRun));
    }
    if (options.testsToRun && options.testsToRun.testFile) {
        testPaths = testPaths.concat(options.testsToRun.testFile.map(f => f.nameToRun));
    }
    if (options.testsToRun && options.testsToRun.testSuite) {
        testPaths = testPaths.concat(options.testsToRun.testSuite.map(f => f.nameToRun));
    }
    if (options.testsToRun && options.testsToRun.testFunction) {
        testPaths = testPaths.concat(options.testsToRun.testFunction.map(f => f.nameToRun));
    }

    let xmlLogFile = '';
    let xmlLogFileCleanup: Function;
    let args = options.args;

    return createTemporaryFile('.xml').then(xmlLogResult => {
        xmlLogFile = xmlLogResult.filePath;
        xmlLogFileCleanup = xmlLogResult.cleanupCallback;
        if (testPaths.length > 0) {
            // Ignore the test directories, as we're running a specific test
            args = args.filter(arg => arg.trim().startsWith('-'));
        }
        const testArgs = testPaths.concat(args, [`--junitxml=${xmlLogFile}`]);
        if (options.debug) {
            const debugLauncher = serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
            const testLauncherFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'testlauncher.py');
            const pytestlauncherargs = [options.cwd, 'pytest'];
            const debuggerArgs = [testLauncherFile].concat(pytestlauncherargs).concat(testArgs);
            const launchOptions = { cwd: options.cwd, args: debuggerArgs, token: options.token, outChannel: options.outChannel };
            // tslint:disable-next-line:prefer-type-cast no-any
            return debugLauncher.launchDebugger(launchOptions) as Promise<any>;
        } else {
            const runOptions: Options = {
                args: testArgs,
                cwd: options.cwd,
                outChannel: options.outChannel,
                token: options.token,
                workspaceFolder: options.workspaceFolder
            };
            return run(serviceContainer, 'pytest', runOptions);
        }
    }).then(() => {
        return updateResultsFromLogFiles(options.tests, xmlLogFile, testResultsService);
    }).then(result => {
        xmlLogFileCleanup();
        return result;
    }).catch(reason => {
        xmlLogFileCleanup();
        return Promise.reject(reason);
    });
}

export function updateResultsFromLogFiles(tests: Tests, outputXmlFile: string, testResultsService: ITestResultsService): Promise<Tests> {
    return updateResultsFromXmlLogFile(tests, outputXmlFile, PassCalculationFormulae.pytest).then(() => {
        testResultsService.updateResults(tests);
        return tests;
    });
}
