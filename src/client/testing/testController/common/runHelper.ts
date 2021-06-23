import { TestItem, TestRun } from 'vscode';
import { TestCase } from './testCase';
import { TestCollection } from './testCollection';
import { TestFile } from './testFile';
import { TestFolder } from './testFolder';
import { TestRunOptions, PythonTestData, PythonRunnableTestData } from './types';
import { WorkspaceTestRoot } from './workspaceTestRoot';

export type TestRunInstanceOptions = TestRunOptions & {
    exclude?: TestItem<PythonTestData>[];
    debug: boolean;
};

export type RunTestFunction = (
    testNode: TestItem<PythonRunnableTestData>,
    runInstance: TestRun<PythonTestData>,
    options: TestRunInstanceOptions,
) => Promise<void>;

export async function processTestNode(
    testNode: TestItem<PythonTestData>,
    runInstance: TestRun<PythonTestData>,
    options: TestRunInstanceOptions,
    runTest: RunTestFunction,
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
        runInstance.appendOutput(`Excluded: ${testNode.label}\r\n`);
    }
    return Promise.resolve();
}
