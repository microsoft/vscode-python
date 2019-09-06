import { inject, injectable } from 'inversify';
import { IFileSystem } from '../../common/platform/types';
import {
    IXUnitParser, PassCalculationFormulae, Tests, TestStatus, TestSummary
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

        // tslint:disable-next-line:no-require-imports
        const xml2js = require('xml2js');
        // tslint:disable-next-line:no-any
        await new Promise<any>((resolve, reject) => {
            xml2js.parseString(data, (error: Error, parserResult: { testsuite: TestSuiteResult }) => {
                if (error) {
                    return reject(error);
                }
                try {
                    updateTests(tests, parserResult.testsuite);
                } catch (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }
}

// Set the number of passing tests given the total number.
function setPassing(
    summary: TestSummary,
    total: number
) {
    summary.passed = total - summary.failures - summary.skipped - summary.errors;
}

// Update "tests" with the given results.
function updateTests(
    tests: Tests,
    testSuiteResult: TestSuiteResult
) {
    tests.summary.errors = getSafeInt(testSuiteResult.$.errors);
    tests.summary.failures = getSafeInt(testSuiteResult.$.failures);
    tests.summary.skipped = getSafeInt(testSuiteResult.$.skips ? testSuiteResult.$.skips : testSuiteResult.$.skip);
    const testCount = getSafeInt(testSuiteResult.$.tests);

    setPassing(tests.summary, testCount);

    if (!Array.isArray(testSuiteResult.testcase)) {
        return;
    }

    testSuiteResult.testcase.forEach((testcase: TestCaseResult) => {
        const xmlClassName = testcase.$.classname.replace(/\(\)/g, '').replace(/\.\./g, '.').replace(/\.\./g, '.').replace(/\.+$/, '');
        const result = tests.testFunctions.find(fn => fn.xmlClassName === xmlClassName && fn.testFunction.name === testcase.$.name);
        if (!result) {
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

        result.testFunction.line = getSafeInt(testcase.$.line, null);
        result.testFunction.file = testcase.$.file;
        result.testFunction.time = parseFloat(testcase.$.time);
        result.testFunction.passed = true;
        result.testFunction.status = TestStatus.Pass;

        if (testcase.failure) {
            result.testFunction.status = TestStatus.Fail;
            result.testFunction.passed = false;
            result.testFunction.message = testcase.failure[0].$.message;
            result.testFunction.traceback = testcase.failure[0]._;
        }

        if (testcase.error) {
            result.testFunction.status = TestStatus.Error;
            result.testFunction.passed = false;
            result.testFunction.message = testcase.error[0].$.message;
            result.testFunction.traceback = testcase.error[0]._;
        }

        if (testcase.skipped) {
            result.testFunction.status = TestStatus.Skipped;
            result.testFunction.passed = undefined;
            result.testFunction.message = testcase.skipped[0].$.message;
            result.testFunction.traceback = '';
        }
    });
}
