// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import { TestItem, TestMessage, TestMessageSeverity, TestResultState, TestRun } from 'vscode';
import { TestCase } from './testCase';
import { TestCollection } from './testCollection';
import { TestFile } from './testFile';
import { TestFolder } from './testFolder';
import { PythonTestData } from './types';

type SupportedTestItemType = TestFolder | TestFile | TestCollection | TestCase;

type TestSuiteResult = {
    $: {
        errors: string;
        failures: string;
        name: string;
        skips: string;
        skip: string;
        tests: string;
        time: string;
    };
    testcase: TestCaseResult[];
};
type TestCaseResult = {
    $: {
        classname: string;
        file: string;
        line: string;
        name: string;
        time: string;
    };
    failure: {
        _: string;
        $: { message: string; type: string };
    }[];
    error: {
        _: string;
        $: { message: string; type: string };
    }[];
    skipped: {
        _: string;
        $: { message: string; type: string };
    }[];
};

async function parseXML(data: string): Promise<unknown> {
    const xml2js = await import('xml2js');

    return new Promise<unknown>((resolve, reject) => {
        xml2js.parseString(data, (error: Error, result: unknown) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

function getJunitResults(parserResult: unknown): TestSuiteResult | undefined {
    // This is the newer JUnit XML format (e.g. pytest 5.1 and later).
    const fullResults = parserResult as { testsuites: { testsuite: TestSuiteResult[] } };
    if (!fullResults.testsuites) {
        return (parserResult as { testsuite: TestSuiteResult }).testsuite;
    }

    const junitSuites = fullResults.testsuites.testsuite;
    if (!Array.isArray(junitSuites)) {
        throw Error('bad JUnit XML data');
    }
    if (junitSuites.length === 0) {
        return undefined;
    }
    if (junitSuites.length > 1) {
        throw Error('got multiple XML results');
    }
    return junitSuites[0];
}

function getSafeInt(value: string, defaultValue = 0): number {
    const num = parseInt(value, 10);
    // eslint-disable-next-line no-restricted-globals
    if (isNaN(num)) {
        return defaultValue;
    }
    return num;
}

async function getTestCaseNodes(
    testNode: TestItem<PythonTestData>,
    collection: TestItem<TestCase>[] = [],
): Promise<TestItem<TestCase>[]> {
    if (testNode.data instanceof TestCase) {
        collection.push(testNode as TestItem<TestCase>);
    }
    const nodes = Array.from(testNode.children.values());
    for (const node of nodes) {
        if (node.data instanceof TestCase) {
            collection.push(node);
        } else {
            await getTestCaseNodes(node, collection);
        }
    }
    return Promise.resolve(collection);
}

export async function updateResultFromJunitXml(
    outputXmlFile: string,
    testNode: TestItem<SupportedTestItemType>,
    runInstance: TestRun<PythonTestData>,
): Promise<void> {
    const data = await fsapi.readFile(outputXmlFile);
    const parserResult = await parseXML(data.toString('utf8'));
    const junitSuite = getJunitResults(parserResult);
    const testCaseNodes = await getTestCaseNodes(testNode);

    if (junitSuite && junitSuite.testcase.length > 0 && testCaseNodes.length > 0) {
        const totalTests = getSafeInt(junitSuite.$.tests);
        const failures = getSafeInt(junitSuite.$.failures);
        const skipped = getSafeInt(junitSuite.$.skips ? junitSuite.$.skips : junitSuite.$.skip);
        const errors = getSafeInt(junitSuite.$.errors);

        runInstance.appendOutput(`Total number of tests passed: ${totalTests - failures - skipped - errors}\r\n`);
        runInstance.appendOutput(`Total number of tests failed: ${failures}\r\n`);
        runInstance.appendOutput(`Total number of tests failed with errors: ${errors}\r\n`);
        runInstance.appendOutput(`Total number of tests skipped: ${skipped}\r\n`);

        testCaseNodes.forEach((node) => {
            const result = junitSuite.testcase.find((t) => {
                const id = `${t.$.file.replace(/\\/g, '/')}::${t.$.name}`;
                return id === node.data.raw.id || node.data.raw.id.endsWith(id);
            });
            if (result) {
                if (result.error) {
                    const error = result.error[0];
                    const text = `${node.data.raw.id} Failed with Error: [${error.$.type}]${error.$.message}\r\n${error._}\r\n\r\n`;
                    const message = new TestMessage(text);
                    message.severity = TestMessageSeverity.Error;

                    runInstance.setState(node, TestResultState.Errored);
                    runInstance.appendOutput(text);
                    runInstance.appendMessage(node, message);
                } else if (result.failure) {
                    const failure = result.failure[0];
                    const text = `${node.data.raw.id} Failed: [${failure.$.type}]${failure.$.message}\r\n${failure._}\r\n`;
                    const message = new TestMessage(text);
                    message.severity = TestMessageSeverity.Information;

                    runInstance.setState(node, TestResultState.Failed);
                    runInstance.appendOutput(text);
                    runInstance.appendMessage(node, message);
                } else if (result.skipped) {
                    const skip = result.skipped[0];
                    const text = `${node.data.raw.id} Skipped: [${skip.$.type}]${skip.$.message}\r\n`;
                    runInstance.setState(node, TestResultState.Skipped);
                    runInstance.appendOutput(text);
                } else {
                    const text = `${node.data.raw.id} Passed\r\n`;
                    runInstance.setState(node, TestResultState.Passed);
                    runInstance.appendOutput(text);
                }
            } else {
                runInstance.appendOutput(`Test result not found for: ${node.data.raw.id}\r\n`);
                runInstance.setState(node, TestResultState.Unset);
            }
        });
    }
}
