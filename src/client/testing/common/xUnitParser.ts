import { inject, injectable } from 'inversify';
import { IFileSystem } from '../../common/platform/types';
import {
    FlattenedTestFunction, IXUnitParser, PassCalculationFormulae,
    TestFunction, Tests, TestStatus, TestSummary
} from './types';

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
    if (isNaN(num)) { return defaultValue; }
    return num;
}

@injectable()
export class XUnitParser implements IXUnitParser {
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem
    ) { }

    // Update "tests" with the results parsed from the given file.
    public async updateResultsFromXmlLogFile(
        tests: Tests,
        outputXmlFile: string,
        passCalculationFormulae: PassCalculationFormulae
    ) {
        switch (passCalculationFormulae) {
            case PassCalculationFormulae.pytest:
            case PassCalculationFormulae.nosetests:
                break;
            default: {
                throw new Error('Unknown Test Pass Calculation');
            }
        }

        const data = await this.fs.readFile(outputXmlFile);
        // Un-comment this line to capture the results file for later use in tests:
        //await fs.writeFile('/tmp/results.xml', data);

        const parserResult = await parseXML(data) as { testsuite: TestSuiteResult };
        updateTests(tests, parserResult.testsuite);
    }
}

// An async wrapper around xml2js.parseString().
// tslint:disable-next-line:no-any
async function parseXML(data: string): Promise<any> {
    // tslint:disable-next-line:no-require-imports
    const xml2js = require('xml2js');
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

// Update "tests" with the given results.
function updateTests(
    tests: Tests,
    testSuiteResult: TestSuiteResult
) {
    updateSummary(tests.summary, testSuiteResult);

    if (!Array.isArray(testSuiteResult.testcase)) {
        return;
    }

    testSuiteResult.testcase.forEach((testcase: TestCaseResult) => {
        const testFunc = findTestFunction(
            tests.testFunctions,
            testcase.$.classname,
            testcase.$.name
        );
        if (!testFunc) {
            // Possible we're dealing with nosetests, where the file name isn't returned to us
            // When dealing with nose tests
            // It is possible to have a test file named x in two separate test sub directories and have same functions/classes
            // And unforutnately xunit log doesn't ouput the filename

            // result = tests.testFunctions.find(fn => fn.testFunction.name === testcase.$.name &&
            //     fn.parentTestSuite && fn.parentTestSuite.name === testcase.$.classname);

            // Look for failed file test
            const fileTest = testcase.$.file && tests.testFiles.find(file => file.nameToRun === testcase.$.file);
            if (fileTest && testcase.error) {
                fileTest.status = TestStatus.Error;
                fileTest.passed = false;
                fileTest.message = testcase.error[0].$.message;
                fileTest.traceback = testcase.error[0]._;
            }
            return;
        }

        testFunc.line = getSafeInt(testcase.$.line, null);
        testFunc.file = testcase.$.file;
        testFunc.time = parseFloat(testcase.$.time);
        testFunc.passed = true;
        testFunc.status = TestStatus.Pass;

        if (testcase.failure) {
            testFunc.status = TestStatus.Fail;
            testFunc.passed = false;
            testFunc.message = testcase.failure[0].$.message;
            testFunc.traceback = testcase.failure[0]._;
        }

        if (testcase.error) {
            testFunc.status = TestStatus.Error;
            testFunc.passed = false;
            testFunc.message = testcase.error[0].$.message;
            testFunc.traceback = testcase.error[0]._;
        }

        if (testcase.skipped) {
            testFunc.status = TestStatus.Skipped;
            testFunc.passed = undefined;
            testFunc.message = testcase.skipped[0].$.message;
            testFunc.traceback = '';
        }
    });
}

// Update the summary with the information in the given results.
function updateSummary(
    summary: TestSummary,
    testSuiteResult: TestSuiteResult
) {
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
