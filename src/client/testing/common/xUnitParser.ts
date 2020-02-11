import { inject, injectable } from 'inversify';
import { IFileSystem } from '../../common/platform/types';
import { FlattenedTestFunction, IXUnitParser, TestFunction, TestResult, Tests, TestStatus, TestSummary } from './types';

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

// tslint:disable-next-line:no-any
function getSafeInt(value: string, defaultValue: any = 0): number {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
        return defaultValue;
    }
    return num;
}

@injectable()
export class XUnitParser implements IXUnitParser {
    constructor(@inject(IFileSystem) private readonly fs: IFileSystem) {}

    // Update "tests" with the results parsed from the given file.
    public async updateResultsFromXmlLogFile(tests: Tests, outputXmlFile: string) {
        const data = await this.fs.readFile(outputXmlFile);

        const parserResult = await parseXML(data);
        const junitResults = getJunitResults(parserResult);
        if (junitResults) {
            updateTests(tests, junitResults);
        }
    }
}

// An async wrapper around xml2js.parseString().
// tslint:disable-next-line:no-any
async function parseXML(data: string): Promise<any> {
    const xml2js = await import('xml2js');
    // tslint:disable-next-line:no-any
    return new Promise<any>((resolve, reject) => {
        // tslint:disable-next-line:no-any
        xml2js.parseString(data, (error: Error, result: any) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

// Return the actual test results from the given data.
// tslint:disable-next-line:no-any
function getJunitResults(parserResult: any): TestSuiteResult | undefined {
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
        return;
    }
    if (junitSuites.length > 1) {
        throw Error('got multiple XML results');
    }
    return junitSuites[0];
}

// Update "tests" with the given results.
function updateTests(tests: Tests, testSuiteResult: TestSuiteResult) {
    updateSummary(tests.summary, testSuiteResult);

    if (!Array.isArray(testSuiteResult.testcase)) {
        return;
    }

    // Update the results for each test.
    // Previously unknown tests are ignored.
    testSuiteResult.testcase.forEach((testcase: TestCaseResult) => {
        const testFunc = findTestFunction(tests.testFunctions, testcase.$.classname, testcase.$.name);
        if (testFunc) {
            updateResultInfo(testFunc, testcase);
            updateResultStatus(testFunc, testcase);
        } else {
            // Possible we're dealing with nosetests, where the file name isn't returned to us
            // When dealing with nose tests
            // It is possible to have a test file named x in two separate test sub directories and have same functions/classes
            // And unforutnately xunit log doesn't ouput the filename

            // result = tests.testFunctions.find(fn => fn.testFunction.name === testcase.$.name &&
            //     fn.parentTestSuite && fn.parentTestSuite.name === testcase.$.classname);

            // Look for failed file test
            const fileTest = testcase.$.file && tests.testFiles.find(file => file.nameToRun === testcase.$.file);
            if (fileTest && testcase.error) {
                updateResultStatus(fileTest, testcase);
            }
        }
    });
}

// Update the summary with the information in the given results.
function updateSummary(summary: TestSummary, testSuiteResult: TestSuiteResult) {
    summary.errors = getSafeInt(testSuiteResult.$.errors);
    summary.failures = getSafeInt(testSuiteResult.$.failures);
    summary.skipped = getSafeInt(testSuiteResult.$.skips ? testSuiteResult.$.skips : testSuiteResult.$.skip);
    const testCount = getSafeInt(testSuiteResult.$.tests);
    summary.passed = testCount - summary.failures - summary.skipped - summary.errors;
}

function findTestFunction(
    candidates: FlattenedTestFunction[],
    className: string,
    funcName: string
): TestFunction | undefined {
    const xmlClassName = className
        .replace(/\(\)/g, '')
        .replace(/\.\./g, '.')
        .replace(/\.\./g, '.')
        .replace(/\.+$/, '');
    const flattened = candidates.find(fn => fn.xmlClassName === xmlClassName && fn.testFunction.name === funcName);
    if (!flattened) {
        return;
    }
    return flattened.testFunction;
}

function updateResultInfo(result: TestResult, testCase: TestCaseResult) {
    result.file = testCase.$.file;
    result.line = getSafeInt(testCase.$.line, null);
    result.time = parseFloat(testCase.$.time);
}

function updateResultStatus(result: TestResult, testCase: TestCaseResult) {
    if (testCase.error) {
        result.status = TestStatus.Error;
        result.passed = false;
        result.message = testCase.error[0].$.message;
        result.traceback = testCase.error[0]._;
    } else if (testCase.failure) {
        result.status = TestStatus.Fail;
        result.passed = false;
        result.message = testCase.failure[0].$.message;
        result.traceback = testCase.failure[0]._;
    } else if (testCase.skipped) {
        result.status = TestStatus.Skipped;
        result.passed = undefined;
        result.message = testCase.skipped[0].$.message;
        result.traceback = '';
    } else {
        result.status = TestStatus.Pass;
        result.passed = true;
    }
}
