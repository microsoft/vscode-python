// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import { Location, TestItem, TestMessage, TestRun } from 'vscode';
import { getTestCaseNodes } from './testItemUtilities';
import { TestData } from './types';

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

export async function updateResultFromJunitXml(
    outputXmlFile: string,
    testNode: TestItem,
    runInstance: TestRun,
    idToRawData: Map<string, TestData>,
): Promise<void> {
    const data = await fsapi.readFile(outputXmlFile);
    const parserResult = await parseXML(data.toString('utf8'));
    const junitSuite = getJunitResults(parserResult);
    const testCaseNodes = getTestCaseNodes(testNode);

    if (junitSuite && junitSuite.testcase.length > 0 && testCaseNodes.length > 0) {
        let failures = 0;
        let skipped = 0;
        let errors = 0;
        let passed = 0;

        testCaseNodes.forEach((node) => {
            const rawTestCaseNode = idToRawData.get(node.id);
            if (!rawTestCaseNode) {
                return;
            }

            const result = junitSuite.testcase.find((t) => {
                const idResult = `${t.$.classname}.${t.$.name}`;
                const idNode = rawTestCaseNode.runId;
                return idResult === idNode || idNode.endsWith(idResult);
            });
            if (result) {
                if (result.error) {
                    errors += 1;
                    const error = result.error[0];
                    const text = `${rawTestCaseNode.rawId} Failed with Error: [${error.$.type}]${error.$.message}\r\n${error._}\r\n\r\n`;
                    const message = new TestMessage(text);

                    if (node.uri && node.range) {
                        message.location = new Location(node.uri, node.range);
                    }

                    runInstance.errored(node, message);
                    runInstance.appendOutput(text);
                } else if (result.failure) {
                    failures += 1;
                    const failure = result.failure[0];
                    const text = `${rawTestCaseNode.rawId} Failed: [${failure.$.type}]${failure.$.message}\r\n${failure._}\r\n`;
                    const message = new TestMessage(text);

                    if (node.uri && node.range) {
                        message.location = new Location(node.uri, node.range);
                    }

                    runInstance.failed(node, message);
                    runInstance.appendOutput(text);
                } else if (result.skipped) {
                    skipped += 1;
                    const skip = result.skipped[0];
                    const text = `${rawTestCaseNode.rawId} Skipped: [${skip.$.type}]${skip.$.message}\r\n`;

                    runInstance.skipped(node);
                    runInstance.appendOutput(text);
                } else {
                    passed += 1;
                    const text = `${rawTestCaseNode.rawId} Passed\r\n`;
                    runInstance.passed(node);
                    runInstance.appendOutput(text);
                }
            } else {
                const text = `Test result not found for: ${rawTestCaseNode.rawId}\r\n`;
                runInstance.appendOutput(text);
                const message = new TestMessage(text);

                if (node.uri && node.range) {
                    message.location = new Location(node.uri, node.range);
                }
                runInstance.errored(node, message);
            }
        });

        runInstance.appendOutput(`Total number of tests expected to run: ${testCaseNodes.length}\r\n`);
        runInstance.appendOutput(`Total number of tests run: ${passed + failures + errors + skipped}\r\n`);
        runInstance.appendOutput(`Total number of tests passed: ${passed}\r\n`);
        runInstance.appendOutput(`Total number of tests failed: ${failures}\r\n`);
        runInstance.appendOutput(`Total number of tests failed with errors: ${errors}\r\n`);
        runInstance.appendOutput(`Total number of tests skipped: ${skipped}\r\n`);
        runInstance.appendOutput(
            `Total number of tests with no result data: ${
                testCaseNodes.length - passed - failures - errors - skipped
            }\r\n`,
        );
    }
}
