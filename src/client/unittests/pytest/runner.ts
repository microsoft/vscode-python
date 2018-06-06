'use strict';
import { inject, injectable } from 'inversify';
import { noop } from '../../common/core.utils';
import { createTemporaryFile } from '../../common/helpers';
import { IServiceContainer } from '../../ioc/types';
import { PYTEST_PROVIDER } from '../common/constants';
import { Options } from '../common/runner';
import { ITestDebugLauncher, ITestManager, ITestResultsService, ITestRunner, IXUnitParser, LaunchOptions, PassCalculationFormulae, TestRunOptions, Tests } from '../common/types';
import { IArgumentsHelper, IArgumentsService, ITestManagerRunner } from '../types';

const JunitXmlArg = '--junitxml';
@injectable()
export class TestManagerRunner implements ITestManagerRunner {
    private readonly argsService: IArgumentsService;
    private readonly argsHelper: IArgumentsHelper;
    private readonly testRunner: ITestRunner;
    private readonly xUnitParser: IXUnitParser;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.argsService = serviceContainer.get<IArgumentsService>(IArgumentsService, PYTEST_PROVIDER);
        this.argsHelper = serviceContainer.get<IArgumentsHelper>(IArgumentsHelper);
        this.testRunner = serviceContainer.get<ITestRunner>(ITestRunner);
        this.xUnitParser = this.serviceContainer.get<IXUnitParser>(IXUnitParser);
    }
    public async runTest(testResultsService: ITestResultsService, options: TestRunOptions, _: ITestManager): Promise<Tests> {
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

        let xmlLogFileCleanup: Function = noop;
        const args = options.args;
        try {
            const xmlLogResult = await this.getJUnitXmlFile(args);
            const xmlLogFile = xmlLogResult.filePath;
            xmlLogFileCleanup = xmlLogResult.cleanupCallback;
            // Remove the '--junixml' if it exists, and add it with our path.
            const testArgs = this.argsService.filterArguments(args, [JunitXmlArg]);
            testArgs.splice(0, 0, `${JunitXmlArg}=${xmlLogFile}`);

            // Positional arguments control the tests to be run.
            testArgs.push(...testPaths);

            if (options.debug) {
                const debugLauncher = this.serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
                const debuggerArgs = [options.cwd, 'pytest'].concat(testArgs);
                const launchOptions: LaunchOptions = { cwd: options.cwd, args: debuggerArgs, token: options.token, outChannel: options.outChannel, testProvider: PYTEST_PROVIDER };
                await debugLauncher.launchDebugger(launchOptions);
            } else {
                const runOptions: Options = {
                    args: testArgs,
                    cwd: options.cwd,
                    outChannel: options.outChannel,
                    token: options.token,
                    workspaceFolder: options.workspaceFolder
                };
                await this.testRunner.run(PYTEST_PROVIDER, runOptions);
            }

            const result = options.debug ? options.tests : await this.updateResultsFromLogFiles(options.tests, xmlLogFile, testResultsService);
            xmlLogFileCleanup();
            return result;
        } catch (ex) {
            xmlLogFileCleanup();
            return Promise.reject<Tests>(ex);
        }
    }

    private async updateResultsFromLogFiles(tests: Tests, outputXmlFile: string, testResultsService: ITestResultsService): Promise<Tests> {
        await this.xUnitParser.updateResultsFromXmlLogFile(tests, outputXmlFile, PassCalculationFormulae.pytest);
        testResultsService.updateResults(tests);
        return tests;
    }

    private async getJUnitXmlFile(args: string[]): Promise<{ filePath: string; cleanupCallback: Function }> {
        const xmlFile = this.argsHelper.getOptionValues(args, JunitXmlArg);
        if (typeof xmlFile === 'string') {
            return { filePath: xmlFile, cleanupCallback: noop };
        }
        return createTemporaryFile('.xml');
    }

}
