// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as os from 'os';
import { inject, injectable, named } from 'inversify';
import { Disposable, test, TestItem, TestResultState, TestRun, TestRunRequest } from 'vscode';
import { IOutputChannel } from '../../../common/types';
import { PYTEST_PROVIDER } from '../../common/constants';
import { ITestDebugLauncher, ITestRunner, LaunchOptions, Options } from '../../common/types';
import { TEST_OUTPUT_CHANNEL } from '../../constants';
import { filterArguments, getOptionValues } from '../common/argumentsHelper';
import { createTemporaryFile } from '../common/externalDependencies';
import { updateResultFromJunitXml } from '../common/resultsHelper';
import { TestCase } from '../common/testCase';
import { TestCollection } from '../common/testCollection';
import { TestFile } from '../common/testFile';
import { TestFolder } from '../common/testFolder';
import { ITestsRunner, PythonRunnableTestData, PythonTestData, TestRunOptions } from '../common/types';
import { WorkspaceTestRoot } from '../common/workspaceTestRoot';
import { removePositionalFoldersAndFiles } from './arguments';

type PytestRunInstanceOptions = TestRunOptions & {
    exclude?: TestItem<PythonTestData>[];
    debug: boolean;
};

type PytestRunTestFunction = (
    testNode: TestItem<PythonRunnableTestData>,
    runInstance: TestRun<TestFolder>,
    options: PytestRunInstanceOptions,
) => Promise<void>;

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

export async function processTestNode(
    testNode: TestItem<PythonTestData>,
    runInstance: TestRun<PythonTestData>,
    options: PytestRunInstanceOptions,
    runTest: PytestRunTestFunction,
): Promise<void> {
    if (!options.exclude?.includes(testNode)) {
        if (testNode.data instanceof WorkspaceTestRoot) {
            const testSubNodes = Array.from(testNode.children.values());
            await Promise.all(testSubNodes.map((subNode) => processTestNode(subNode, runInstance, options, runTest)));
        }
        if (testNode.data instanceof TestFolder) {
            return runTest(testNode as TestItem<TestFolder>, runInstance, options);
        }
        if (testNode.data instanceof TestFile) {
            return runTest(testNode as TestItem<TestFile>, runInstance, options);
        }
        if (testNode.data instanceof TestCollection) {
            return runTest(testNode as TestItem<TestCollection>, runInstance, options);
        }
        if (testNode.data instanceof TestCase) {
            return runTest(testNode as TestItem<TestCase>, runInstance, options);
        }
    } else {
        runInstance.appendOutput(`Excluded: ${testNode.label}${os.EOL}`);
    }
    return Promise.resolve();
}

@injectable()
export class PytestRunner implements ITestsRunner {
    constructor(
        @inject(ITestRunner) private readonly runner: ITestRunner,
        @inject(ITestDebugLauncher) private readonly debugLauncher: ITestDebugLauncher,
        @inject(IOutputChannel) @named(TEST_OUTPUT_CHANNEL) private readonly outputChannel: IOutputChannel,
    ) {}

    public async runTests(request: TestRunRequest<PythonTestData>, options: TestRunOptions): Promise<void> {
        const runOptions: PytestRunInstanceOptions = {
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
            runInstance.appendOutput(`Error while running tests:${os.EOL}${ex}${os.EOL}${os.EOL}`);
        } finally {
            runInstance.appendOutput(`Finished running tests!${os.EOL}`);
            runInstance.end();
        }
    }

    private async runTest(
        testNode: TestItem<TestFolder | TestFile | TestCollection | TestCase>,
        runInstance: TestRun<PythonTestData>,
        options: PytestRunInstanceOptions,
    ): Promise<void> {
        runInstance.appendOutput(`Running tests: ${testNode.label}${os.EOL}`);
        runInstance.setState(testNode, TestResultState.Running);

        const disposables: Disposable[] = [];
        const junitFilePath = await getPytestJunitXmlTempFile(options.args, disposables);

        try {
            // Remove positional test folders and files, we will add as needed per node
            let testArgs = removePositionalFoldersAndFiles(options.args);

            // Remove the '--junitxml' or '--junit-xml' if it exists, and add it with our path.
            testArgs = filterArguments(testArgs, [JunitXmlArg, JunitXmlArgOld]);
            testArgs.splice(0, 0, `${JunitXmlArg}=${junitFilePath}`);

            testArgs.splice(0, 0, '--rootdir', options.workspaceFolder.fsPath);
            testArgs.splice(0, 0, '--override-ini', 'junit_family=xunit1');

            // Positional arguments control the tests to be run.
            testArgs.push(testNode.data.raw.id);

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
                runInstance.appendOutput(`Running test with arguments: ${runOptions.args.join(' ')}${os.EOL}`);
                runInstance.appendOutput(`Current working directory: ${runOptions.cwd}${os.EOL}`);
                runInstance.appendOutput(`Workspace directory: ${runOptions.workspaceFolder.fsPath}${os.EOL}`);
                await this.runner.run(PYTEST_PROVIDER, runOptions);
            }

            runInstance.appendOutput(`Run completed, parsing output${os.EOL}`);
            await updateResultFromJunitXml(junitFilePath, testNode, runInstance);
        } catch (ex) {
            runInstance.appendOutput(`Error while running tests: ${testNode.label}${os.EOL}${ex}${os.EOL}${os.EOL}`);
            return Promise.reject(ex);
        } finally {
            disposables.forEach((d) => d.dispose());
        }
        return Promise.resolve();
    }
}
