'use strict';
import * as path from 'path';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { createTemporaryFile } from '../../common/helpers';
import { run } from '../common/runner';
import { ITestDebugLauncher, ITestResultsService, Tests, TestsToRun } from '../common/types';
import { PassCalculationFormulae, updateResultsFromXmlLogFile } from '../common/xUnitParser';

const WITH_XUNIT = '--with-xunit';
const XUNIT_FILE = '--xunit-file';

// tslint:disable-next-line:no-any
export function runTest(testResultsService: ITestResultsService, debugLauncher: ITestDebugLauncher, rootDirectory: string, tests: Tests, args: string[], testsToRun?: TestsToRun, token?: CancellationToken, outChannel?: OutputChannel, debug?: boolean): Promise<any> {
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
    // tslint:disable-next-line:no-empty
    let xmlLogFileCleanup: Function = () => { };

    // Check if '--with-xunit' is in args list
    const noseTestArgs = args.slice();
    if (noseTestArgs.indexOf(WITH_XUNIT) === -1) {
        noseTestArgs.push(WITH_XUNIT);
    }

    // Check if '--xunit-file' exists, if not generate random xml file
    const indexOfXUnitFile = noseTestArgs.findIndex(value => value.indexOf(XUNIT_FILE) === 0);
    let promiseToGetXmlLogFile: Promise<string>;
    if (indexOfXUnitFile === -1) {
        promiseToGetXmlLogFile = createTemporaryFile('.xml').then(xmlLogResult => {
            xmlLogFileCleanup = xmlLogResult.cleanupCallback;
            xmlLogFile = xmlLogResult.filePath;

            noseTestArgs.push(`${XUNIT_FILE}=${xmlLogFile}`);
            return xmlLogResult.filePath;
        });
    } else {
        if (noseTestArgs[indexOfXUnitFile].indexOf('=') === -1) {
            xmlLogFile = noseTestArgs[indexOfXUnitFile + 1];
        } else {
            xmlLogFile = noseTestArgs[indexOfXUnitFile].substring(noseTestArgs[indexOfXUnitFile].indexOf('=') + 1).trim();
        }

        promiseToGetXmlLogFile = Promise.resolve(xmlLogFile);
    }

    return promiseToGetXmlLogFile.then(() => {
        const pythonSettings = PythonSettings.getInstance(Uri.file(rootDirectory));
        if (debug === true) {
            const testLauncherFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'testlauncher.py');
            const nosetestlauncherargs = [rootDirectory, 'my_secret', pythonSettings.unitTest.debugPort.toString(), 'nose'];
            const debuggerArgs = [testLauncherFile].concat(nosetestlauncherargs).concat(noseTestArgs.concat(testPaths));
            // tslint:disable-next-line:prefer-type-cast no-any
            return debugLauncher.launchDebugger(rootDirectory, debuggerArgs, token, outChannel) as Promise<any>;
        } else {
            // tslint:disable-next-line:prefer-type-cast no-any
            return run(pythonSettings.unitTest.nosetestPath, noseTestArgs.concat(testPaths), rootDirectory, token, outChannel) as Promise<any>;
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

// tslint:disable-next-line:no-any
export function updateResultsFromLogFiles(tests: Tests, outputXmlFile: string, testResultsService: ITestResultsService): Promise<any> {
    return updateResultsFromXmlLogFile(tests, outputXmlFile, PassCalculationFormulae.nosetests).then(() => {
        testResultsService.updateResults(tests);
        return tests;
    });
}
