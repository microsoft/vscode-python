'use strict';
import * as path from 'path';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { createTemporaryFile } from '../../common/helpers';
import { run } from '../common/runner';
import { ITestDebugLauncher, ITestResultsService, Tests, TestsToRun } from '../common/types';
import { PassCalculationFormulae, updateResultsFromXmlLogFile } from '../common/xUnitParser';

export function runTest(testResultsService: ITestResultsService, debugLauncher: ITestDebugLauncher, rootDirectory: string, tests: Tests, args: string[], testsToRun?: TestsToRun, token?: CancellationToken, outChannel?: OutputChannel, debug?: boolean): Promise<Tests> {
    let testPaths = [];
    if (testsToRun && testsToRun.testFolder) {
        testPaths = testPaths.concat(testsToRun.testFolder.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testFile) {
        testPaths = testPaths.concat(testsToRun.testFile.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testSuite) {
        testPaths = testPaths.concat(testsToRun.testSuite.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testFunction) {
        testPaths = testPaths.concat(testsToRun.testFunction.map(f => f.nameToRun));
    }

    let xmlLogFile = '';
    let xmlLogFileCleanup: Function = null;

    return createTemporaryFile('.xml').then(xmlLogResult => {
        xmlLogFile = xmlLogResult.filePath;
        xmlLogFileCleanup = xmlLogResult.cleanupCallback;
        if (testPaths.length > 0) {
            // Ignore the test directories, as we're running a specific test
            args = args.filter(arg => arg.trim().startsWith('-'));
        }
        const testArgs = testPaths.concat(args, [`--junitxml=${xmlLogFile}`]);
        const pythonSettings = PythonSettings.getInstance(Uri.file(rootDirectory));
        if (debug) {
            const testLauncherFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'testlauncher.py');
            const pytestlauncherargs = [rootDirectory, 'my_secret', pythonSettings.unitTest.debugPort.toString(), 'pytest'];
            const debuggerArgs = [testLauncherFile].concat(pytestlauncherargs).concat(testArgs);
            // tslint:disable-next-line:prefer-type-cast no-any
            return debugLauncher.launchDebugger(rootDirectory, debuggerArgs, token, outChannel) as Promise<any>;
        } else {
            // tslint:disable-next-line:prefer-type-cast no-any
            return run(pythonSettings.unitTest.pyTestPath, testArgs, rootDirectory, token, outChannel) as Promise<any>;
        }
    }).then(() => {
        return updateResultsFromLogFiles(tests, xmlLogFile, testResultsService);
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
