// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { Disposable, TestItem, TestRun, TestRunProfileKind } from 'vscode';
import { IOutputChannel } from '../../../common/types';
import { PYTEST_PROVIDER } from '../../common/constants';
import { ITestDebugLauncher, ITestRunner, LaunchOptions, Options } from '../../common/types';
import { TEST_OUTPUT_CHANNEL } from '../../constants';
import { filterArguments, getOptionValues } from '../common/argumentsHelper';
import { createTemporaryFile } from '../common/externalDependencies';
import { updateResultFromJunitXml } from '../common/resultsHelper';
import { getTestCaseNodes } from '../common/testItemUtilities';
import { ITestRun, ITestsRunner, TestData, TestRunInstanceOptions, TestRunOptions } from '../common/types';
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

    public async runTests(
        testRun: ITestRun,
        options: TestRunOptions,
        idToRawData: Map<string, TestData>,
    ): Promise<void> {
        const runOptions: TestRunInstanceOptions = {
            ...options,
            exclude: testRun.excludes,
            debug: testRun.runKind === TestRunProfileKind.Debug,
        };

        try {
            await Promise.all(
                testRun.includes.map((testNode) =>
                    this.runTest(testNode, testRun.runInstance, runOptions, idToRawData),
                ),
            );
        } catch (ex) {
            testRun.runInstance.appendOutput(`Error while running tests:\r\n${ex}\r\n\r\n`);
        }
    }

    private async runTest(
        testNode: TestItem,
        runInstance: TestRun,
        options: TestRunInstanceOptions,
        idToRawData: Map<string, TestData>,
    ): Promise<void> {
        runInstance.appendOutput(`Running tests (pytest): ${testNode.id}\r\n`);

        // VS Code API requires that we set the run state on the leaf nodes. The state of the
        // parent nodes are computed based on the state of child nodes.
        const testCaseNodes = getTestCaseNodes(testNode);
        testCaseNodes.forEach((node) => runInstance.started(node));

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

            // if user has provided `--rootdir` then use that, otherwise add `cwd`
            if (testArgs.filter((a) => a.startsWith('--rootdir')).length === 0) {
                // Make sure root dir is set so pytest can find the relative paths
                testArgs.splice(0, 0, '--rootdir', options.cwd);
            }

            // Positional arguments control the tests to be run.
            const rawData = idToRawData.get(testNode.id);
            if (!rawData) {
                throw new Error(`Trying to run unknown node: ${testNode.id}`);
            }
            if (testNode.id !== options.cwd) {
                testArgs.push(rawData.rawId);
            }

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
            await updateResultFromJunitXml(junitFilePath, testNode, runInstance, idToRawData);
        } catch (ex) {
            runInstance.appendOutput(`Error while running tests: ${testNode.label}\r\n${ex}\r\n\r\n`);
            return Promise.reject(ex);
        } finally {
            disposables.forEach((d) => d.dispose());
        }
        return Promise.resolve();
    }
}
