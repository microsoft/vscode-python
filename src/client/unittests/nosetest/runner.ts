'use strict';
import { createTemporaryFile } from '../../common/helpers';
import { IServiceContainer } from '../../ioc/types';
import { Options, run } from '../common/runner';
import { ITestDebugLauncher, ITestResultsService, LaunchOptions, TestRunOptions, Tests } from '../common/types';
import { PassCalculationFormulae, updateResultsFromXmlLogFile } from '../common/xUnitParser';

const WITH_XUNIT = '--with-xunit';
const XUNIT_FILE = '--xunit-file';

// tslint:disable-next-line:no-any
export function runTest(serviceContainer: IServiceContainer, testResultsService: ITestResultsService, options: TestRunOptions): Promise<any> {
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
    // tslint:disable-next-line:no-empty
    let xmlLogFileCleanup: Function = () => { };

    // Check if '--with-xunit' is in args list
    const noseTestArgs = options.args.slice();
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
        if (options.debug === true) {
            const debugLauncher = serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
            const nosetestlauncherargs = [options.cwd, 'nose'];
            const debuggerArgs = nosetestlauncherargs.concat(noseTestArgs.concat(testPaths));
            const launchOptions: LaunchOptions = { cwd: options.cwd, args: debuggerArgs, token: options.token, outChannel: options.outChannel, testProvider: 'nosetest' };
            // tslint:disable-next-line:prefer-type-cast no-any
            return debugLauncher.launchDebugger(launchOptions) as Promise<any>;
        } else {
            // tslint:disable-next-line:prefer-type-cast no-any
            const runOptions: Options = {
                args: noseTestArgs.concat(testPaths),
                cwd: options.cwd,
                outChannel: options.outChannel,
                token: options.token,
                workspaceFolder: options.workspaceFolder
            };

            // Remove the directory argument, as we'll provide tests to be run.
            if (testPaths.length > 0 && runOptions.args.length > 0 && !runOptions.args[0].trim().startsWith('-')) {
                runOptions.args.shift();
            }
            return run(serviceContainer, 'nosetest', runOptions);
        }
    }).then(() => {
        return options.debug ? options.tests : updateResultsFromLogFiles(options.tests, xmlLogFile, testResultsService);
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
