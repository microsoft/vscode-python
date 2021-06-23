// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { Disposable, test, TestItem, TestResultState, TestRun, TestRunRequest } from 'vscode';
import { IOutputChannel } from '../../../common/types';
import { PYTEST_PROVIDER } from '../../common/constants';
import { ITestDebugLauncher, ITestRunner, LaunchOptions, Options } from '../../common/types';
import { TEST_OUTPUT_CHANNEL } from '../../constants';
import { filterArguments, getOptionValues } from '../common/argumentsHelper';
import { createTemporaryFile } from '../common/externalDependencies';
import { updateResultFromJunitXml } from '../common/resultsHelper';
import { processTestNode, TestRunInstanceOptions } from '../common/runHelper';
import { getTestCaseNodes } from '../common/testItemUtilities';
import { ITestsRunner, PythonRunnableTestData, PythonTestData, TestRunOptions } from '../common/types';
import { removePositionalFoldersAndFiles } from './arguments';

const JunitXmlArgOld = '--junitxml';
const JunitXmlArg = '--junit-xml';

async function getPytestJunitXmlTempFile(args: string[], disposables: Disposable[]): Promise<string> {
    const argValues = getOptionValues(args, JunitXmlArg);
    if (argValues.length === 1) {
        return argValues[0];
    }
    const tempFile = await createTemporaryFile('.xml');
    disposables.push(tempFile);
    return tempFile.filePath;
}

@injectable()
export class PytestRunner implements ITestsRunner {
    constructor(
        @inject(ITestRunner) private readonly runner: ITestRunner,
        @inject(ITestDebugLauncher) private readonly debugLauncher: ITestDebugLauncher,
        @inject(IOutputChannel) @named(TEST_OUTPUT_CHANNEL) private readonly outputChannel: IOutputChannel,
    ) {}

    public async runTests(request: TestRunRequest<PythonTestData>, options: TestRunOptions): Promise<void> {
        const runOptions: TestRunInstanceOptions = {
            ...options,
            exclude: request.exclude,
            debug: request.debug,
        };
        const runInstance = test.createTestRun(request);
        try {
            await Promise.all(
                request.tests.map((testNode) =>
                    processTestNode(testNode, runInstance, runOptions, this.runTest.bind(this)),
                ),
            );
        } catch (ex) {
            runInstance.appendOutput(`Error while running tests:\r\n${ex}\r\n\r\n`);
        } finally {
            runInstance.appendOutput(`Finished running tests!\r\n`);
            runInstance.end();
        }
    }

    private async runTest(
        testNode: TestItem<PythonRunnableTestData>,
        runInstance: TestRun<PythonTestData>,
        options: TestRunInstanceOptions,
    ): Promise<void> {
        runInstance.appendOutput(`Running tests: ${testNode.label}\r\n`);

        // VS Code API requires that we set the run state on the leaf nodes. The state of the
        // parent nodes are computed based on the state of child nodes.
        const testCaseNodes = getTestCaseNodes(testNode);
        testCaseNodes.forEach((node) => runInstance.setState(node, TestResultState.Running));

        // For pytest we currently use JUnit XML to get the results. We create a temporary file here
        // to ensure that the file is removed when we are done reading the result.
        const disposables: Disposable[] = [];
        const junitFilePath = await getPytestJunitXmlTempFile(options.args, disposables);

        try {
            // Remove positional test folders and files, we will add as needed per node
            let testArgs = removePositionalFoldersAndFiles(options.args);

            // Remove the '--junitxml' or '--junit-xml' if it exists, and add it with our path.
            testArgs = filterArguments(testArgs, [JunitXmlArg, JunitXmlArgOld]);
            testArgs.splice(0, 0, `${JunitXmlArg}=${junitFilePath}`);

            // Ensure that we use the xunit1 format.
            testArgs.splice(0, 0, '--override-ini', 'junit_family=xunit1');

            // Make sure root dir is set so pytest can find the relative paths
            testArgs.splice(0, 0, '--rootdir', options.workspaceFolder.fsPath);

            // Positional arguments control the tests to be run.
            testArgs.push(testNode.data.raw.id);

            runInstance.appendOutput(`Running test with arguments: ${testArgs.join(' ')}\r\n`);
            runInstance.appendOutput(`Current working directory: ${options.cwd}\r\n`);
            runInstance.appendOutput(`Workspace directory: ${options.workspaceFolder.fsPath}\r\n`);

            if (options.debug) {
                const debuggerArgs = [options.cwd, 'pytest'].concat(testArgs);
                const launchOptions: LaunchOptions = {
                    cwd: options.cwd,
                    args: debuggerArgs,
                    token: options.token,
                    outChannel: this.outputChannel,
                    testProvider: PYTEST_PROVIDER,
                };
                await this.debugLauncher.launchDebugger(launchOptions);
            } else {
                const runOptions: Options = {
                    args: testArgs,
                    cwd: options.cwd,
                    outChannel: this.outputChannel,
                    token: options.token,
                    workspaceFolder: options.workspaceFolder,
                };
                await this.runner.run(PYTEST_PROVIDER, runOptions);
            }

            // At this point pytest has finished running, we now have to parse the output
            runInstance.appendOutput(`Run completed, parsing output\r\n`);
            await updateResultFromJunitXml(junitFilePath, testNode, runInstance);
        } catch (ex) {
            runInstance.appendOutput(`Error while running tests: ${testNode.label}\r\n${ex}\r\n\r\n`);
            return Promise.reject(ex);
        } finally {
            disposables.forEach((d) => d.dispose());
        }
        return Promise.resolve();
    }
}
