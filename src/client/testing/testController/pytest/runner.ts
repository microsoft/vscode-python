// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { CancellationToken, Disposable, test, TestItem, TestResultState, TestRun, TestRunRequest, Uri } from 'vscode';
import { IDisposableRegistry } from '../../../common/types';
import { filterArguments, getOptionValues } from '../common/argumentsHelper';
import { createTemporaryFile } from '../common/externalDependencies';
import { TestCase } from '../common/testCase';
import { TestCollection } from '../common/testCollection';
import { TestFile } from '../common/testFile';
import { TestFolder } from '../common/testFolder';
import { PythonTestData } from '../common/types';
import { WorkspaceTestRoot } from '../common/workspaceTestRoot';

export type TestRunOptions = {
    workspaceFolder: Uri;
    cwd: string;
    args: string[];
    token: CancellationToken;
};

type PytestRunInstanceOptions = TestRunOptions & {
    exclude?: TestItem<PythonTestData>[];
    debug: boolean;
};

type PytestRunTestFunction = (
    tests: string[],
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
        runInstance.appendOutput(`Running tests: ${testNode.label}`);
        runInstance.setState(testNode, TestResultState.Running);
        if (testNode.data instanceof WorkspaceTestRoot) {
            const testSubNodes = Array.from(testNode.children.values());
            await Promise.all(testSubNodes.map((subNode) => processTestNode(subNode, runInstance, options, runTest)));
        }
        if (testNode.data instanceof TestFolder) {
            return runTest([(testNode as TestItem<TestFolder>).data.raw.id], runInstance, options);
        }
        if (testNode.data instanceof TestFile) {
            return runTest([(testNode as TestItem<TestFile>).data.raw.id], runInstance, options);
        }
        if (testNode.data instanceof TestCollection) {
            return runTest([(testNode as TestItem<TestCollection>).data.raw.id], runInstance, options);
        }
        if (testNode.data instanceof TestCase) {
            return runTest([(testNode as TestItem<TestCase>).data.raw.id], runInstance, options);
        }
    } else {
        runInstance.appendOutput(`Excluded: ${testNode.label}`);
    }
    return Promise.resolve();
}

export interface ITestRunner {
    runTests(request: TestRunRequest<PythonTestData>, options: TestRunOptions): Promise<void>;
}

@injectable()
export class PytestRunner implements ITestRunner {
    constructor(@inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry) {}

    public async runTests(request: TestRunRequest<PythonTestData>, options: TestRunOptions): Promise<void> {
        const runOptions: PytestRunInstanceOptions = {
            ...options,
            exclude: request.exclude,
            debug: request.debug,
        };
        const runInstance = test.createTestRun(request);
        await Promise.all(
            request.tests.map((testNode) =>
                processTestNode(testNode, runInstance, runOptions, this.runTest.bind(this)),
            ),
        );
    }

    private async runTest(
        testRunIds: string[],
        runInstance: TestRun<PythonTestData>,
        options: PytestRunInstanceOptions,
    ): Promise<void> {
        const junitFilePath = await getPytestJunitXmlTempFile(options.args, this.disposables);

        // Remove the '--junitxml' or '--junit-xml' if it exists, and add it with our path.
        const testArgs = filterArguments(options.args, [JunitXmlArg, JunitXmlArgOld]);
        testArgs.splice(0, 0, `${JunitXmlArg}=${junitFilePath}`);

        testArgs.splice(0, 0, '--rootdir', options.workspaceFolder.fsPath);
        testArgs.splice(0, 0, '--override-ini', 'junit_family=xunit1');

        // Positional arguments control the tests to be run.
        testArgs.push(...testRunIds);
    }
}
