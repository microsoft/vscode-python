'use strict';

import { inject, injectable } from 'inversify';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { NOSETEST_PROVIDER } from '../common/constants';
import { Options } from '../common/runner';
import {
    ITestDebugLauncher,
    ITestManager,
    ITestResultsService,
    ITestRunner,
    IXUnitParser,
    LaunchOptions,
    TestRunOptions,
    Tests,
} from '../common/types';
import { IArgumentsHelper, IArgumentsService, ITestManagerRunner } from '../types';

const WITH_XUNIT = '--with-xunit';
const XUNIT_FILE = '--xunit-file';

@injectable()
export class TestManagerRunner implements ITestManagerRunner {
    private readonly argsService: IArgumentsService;
    private readonly argsHelper: IArgumentsHelper;
    private readonly testRunner: ITestRunner;
    private readonly xUnitParser: IXUnitParser;
    private readonly fs: IFileSystem;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.argsService = serviceContainer.get<IArgumentsService>(IArgumentsService, NOSETEST_PROVIDER);
        this.argsHelper = serviceContainer.get<IArgumentsHelper>(IArgumentsHelper);
        this.testRunner = serviceContainer.get<ITestRunner>(ITestRunner);
        this.xUnitParser = this.serviceContainer.get<IXUnitParser>(IXUnitParser);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
    }
    public async runTest(
        testResultsService: ITestResultsService,
        options: TestRunOptions,
        _: ITestManager
    ): Promise<Tests> {
        let testPaths: string[] = [];
        if (options.testsToRun && options.testsToRun.testFolder) {
            testPaths = testPaths.concat(options.testsToRun.testFolder.map((f) => f.nameToRun));
        }
        if (options.testsToRun && options.testsToRun.testFile) {
            testPaths = testPaths.concat(options.testsToRun.testFile.map((f) => f.nameToRun));
        }
        if (options.testsToRun && options.testsToRun.testSuite) {
            testPaths = testPaths.concat(options.testsToRun.testSuite.map((f) => f.nameToRun));
        }
        if (options.testsToRun && options.testsToRun.testFunction) {
            testPaths = testPaths.concat(options.testsToRun.testFunction.map((f) => f.nameToRun));
        }

        let deleteJUnitXmlFile: Function = noop;
        const args = options.args;
        // Check if '--with-xunit' is in args list
        if (args.indexOf(WITH_XUNIT) === -1) {
            args.splice(0, 0, WITH_XUNIT);
        }

        try {
            const xmlLogResult = await this.getUnitXmlFile(args);
            const xmlLogFile = xmlLogResult.filePath;
            deleteJUnitXmlFile = xmlLogResult.dispose;
            // Remove the '--unixml' if it exists, and add it with our path.
            const testArgs = this.argsService.filterArguments(args, [XUNIT_FILE]);
            testArgs.splice(0, 0, `${XUNIT_FILE}=${xmlLogFile}`);

            // Positional arguments control the tests to be run.
            testArgs.push(...testPaths);

            if (options.debug === true) {
                const debugLauncher = this.serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
                const debuggerArgs = [options.cwd, 'nose'].concat(testArgs);
                const launchOptions: LaunchOptions = {
                    cwd: options.cwd,
                    args: debuggerArgs,
                    token: options.token,
                    outChannel: options.outChannel,
                    testProvider: NOSETEST_PROVIDER,
                };
                await debugLauncher.launchDebugger(launchOptions);
            } else {
                const runOptions: Options = {
                    args: testArgs.concat(testPaths),
                    cwd: options.cwd,
                    outChannel: options.outChannel,
                    token: options.token,
                    workspaceFolder: options.workspaceFolder,
                };
                await this.testRunner.run(NOSETEST_PROVIDER, runOptions);
            }

            return options.debug
                ? options.tests
                : await this.updateResultsFromLogFiles(options.tests, xmlLogFile, testResultsService);
        } catch (ex) {
            return Promise.reject<Tests>(ex);
        } finally {
            deleteJUnitXmlFile();
        }
    }

    private async updateResultsFromLogFiles(
        tests: Tests,
        outputXmlFile: string,
        testResultsService: ITestResultsService
    ): Promise<Tests> {
        await this.xUnitParser.updateResultsFromXmlLogFile(tests, outputXmlFile);
        testResultsService.updateResults(tests);
        return tests;
    }
    private async getUnitXmlFile(args: string[]): Promise<TemporaryFile> {
        const xmlFile = this.argsHelper.getOptionValues(args, XUNIT_FILE);
        if (typeof xmlFile === 'string') {
            return { filePath: xmlFile, dispose: noop };
        }

        return this.fs.createTemporaryFile('.xml');
    }
}
