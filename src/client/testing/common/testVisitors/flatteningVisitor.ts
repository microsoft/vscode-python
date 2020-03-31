import { injectable } from 'inversify';
import { convertFileToPackage } from '../testUtils';
import {
    FlattenedTestFunction,
    FlattenedTestSuite,
    ITestVisitor,
    TestFile,
    TestFolder,
    TestFunction,
    TestSuite
} from '../types';

@injectable()
export class TestFlatteningVisitor implements ITestVisitor {
    // tslint:disable-next-line:variable-name
    private _flattedTestFunctions = new Map<string, FlattenedTestFunction>();
    // tslint:disable-next-line:variable-name
    private _flattenedTestSuites = new Map<string, FlattenedTestSuite>();
    public get flattenedTestFunctions(): FlattenedTestFunction[] {
        return [...this._flattedTestFunctions.values()];
    }
    public get flattenedTestSuites(): FlattenedTestSuite[] {
        return [...this._flattenedTestSuites.values()];
    }
    // tslint:disable-next-line:no-empty
    public visitTestFunction(_testFunction: TestFunction): void {}
    // tslint:disable-next-line:no-empty
    public visitTestSuite(_testSuite: TestSuite): void {}
    public visitTestFile(testFile: TestFile): void {
        // sample test_three (file name without extension and all / replaced with ., meaning this is the package)
        const packageName = convertFileToPackage(testFile.name);

        testFile.functions.forEach((fn) => this.addTestFunction(fn, testFile, packageName));
        testFile.suites.forEach((suite) => this.visitTestSuiteOfAFile(suite, testFile));
    }
    // tslint:disable-next-line:no-empty
    public visitTestFolder(_testFile: TestFolder) {}
    private visitTestSuiteOfAFile(testSuite: TestSuite, parentTestFile: TestFile): void {
        testSuite.functions.forEach((fn) => this.visitTestFunctionOfASuite(fn, testSuite, parentTestFile));
        testSuite.suites.forEach((suite) => this.visitTestSuiteOfAFile(suite, parentTestFile));
        this.addTestSuite(testSuite, parentTestFile);
    }
    private visitTestFunctionOfASuite(
        testFunction: TestFunction,
        parentTestSuite: TestSuite,
        parentTestFile: TestFile
    ) {
        const key = `Function:${testFunction.name},Suite:${parentTestSuite.name},SuiteXmlName:${parentTestSuite.xmlName},ParentFile:${parentTestFile.fullPath}`;
        if (this._flattenedTestSuites.has(key)) {
            return;
        }
        const flattenedFunction = {
            testFunction,
            xmlClassName: parentTestSuite.xmlName,
            parentTestFile,
            parentTestSuite
        };
        this._flattedTestFunctions.set(key, flattenedFunction);
    }
    private addTestSuite(testSuite: TestSuite, parentTestFile: TestFile) {
        const key = `Suite:${testSuite.name},SuiteXmlName:${testSuite.xmlName},ParentFile:${parentTestFile.fullPath}`;
        if (this._flattenedTestSuites.has(key)) {
            return;
        }
        const flattenedSuite = { parentTestFile, testSuite, xmlClassName: testSuite.xmlName };
        this._flattenedTestSuites.set(key, flattenedSuite);
    }
    private addTestFunction(testFunction: TestFunction, parentTestFile: TestFile, parentTestPackage: string) {
        const key = `Function:${testFunction.name},ParentFile:${parentTestFile.fullPath}`;
        if (this._flattedTestFunctions.has(key)) {
            return;
        }
        const flattendFunction = { testFunction, xmlClassName: parentTestPackage, parentTestFile };
        this._flattedTestFunctions.set(key, flattendFunction);
    }
}
