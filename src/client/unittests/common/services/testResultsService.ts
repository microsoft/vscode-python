import { inject, injectable, named } from 'inversify';
import { ITestResultsService, ITestVisitor, TestFile, TestFolder, Tests, TestStatus, TestSuite } from './../types';

@injectable()
export class TestResultsService implements ITestResultsService {
    constructor(@inject(ITestVisitor) @named('TestResultResetVisitor') private resultResetVisitor: ITestVisitor) { }
    public resetResults(tests: Tests): void {
        tests.testFolders.forEach(f => this.resultResetVisitor.visitTestFolder(f));
        tests.testFunctions.forEach(fn => this.resultResetVisitor.visitTestFunction(fn.testFunction));
        tests.testSuites.forEach(suite => this.resultResetVisitor.visitTestSuite(suite.testSuite));
        tests.testFiles.forEach(testFile => this.resultResetVisitor.visitTestFile(testFile));
    }
    public updateResults(tests: Tests): void {
        tests.testFiles.forEach(test => this.updateTestFileResults(test));
        tests.testFolders.forEach(folder => this.updateTestFolderResults(folder));
    }
    private updateTestSuiteResults(test: TestSuite): void {
        this.updateTestSuiteAndFileResults(test);
    }
    private updateTestFileResults(test: TestFile): void {
        this.updateTestSuiteAndFileResults(test);
    }
    private updateTestFolderResults(testFolder: TestFolder): void {
        let allFilesPassed = true;
        let allFilesRan = true;

        testFolder.testFiles.forEach(fl => {
            if (allFilesPassed && typeof fl.passed === 'boolean') {
                if (!fl.passed) {
                    allFilesPassed = false;
                }
            } else {
                allFilesRan = false;
            }

            testFolder.functionsFailed! += fl.functionsFailed!;
            testFolder.functionsPassed! += fl.functionsPassed!;
        });

        let allFoldersPassed = true;
        let allFoldersRan = true;

        testFolder.folders.forEach(folder => {
            this.updateTestFolderResults(folder);
            if (allFoldersPassed && typeof folder.passed === 'boolean') {
                if (!folder.passed) {
                    allFoldersPassed = false;
                }
            } else {
                allFoldersRan = false;
            }

            testFolder.functionsFailed! += folder.functionsFailed!;
            testFolder.functionsPassed! += folder.functionsPassed!;
        });

        if (allFilesRan && allFoldersRan) {
            testFolder.passed = allFilesPassed && allFoldersPassed;
            testFolder.status = testFolder.passed ? TestStatus.Idle : TestStatus.Fail;
        } else {
            testFolder.passed = undefined;
            testFolder.status = TestStatus.Unknown;
        }
    }
    private updateTestSuiteAndFileResults(test: TestSuite | TestFile): void {
        let totalTime = 0;
        let allFunctionsPassed = true;
        let allFunctionsRan = true;

        test.functions.forEach(fn => {
            totalTime += fn.time;
            if (typeof fn.passed === 'boolean') {
                if (fn.passed) {
                    test.functionsPassed! += 1;
                } else {
                    test.functionsFailed! += 1;
                    allFunctionsPassed = false;
                }
            } else {
                allFunctionsRan = false;
            }
        });

        let allSuitesPassed = true;
        let allSuitesRan = true;

        test.suites.forEach(suite => {
            this.updateTestSuiteResults(suite);
            totalTime += suite.time;
            if (allSuitesRan && typeof suite.passed === 'boolean') {
                if (!suite.passed) {
                    allSuitesPassed = false;
                }
            } else {
                allSuitesRan = false;
            }

            test.functionsFailed! += suite.functionsFailed!;
            test.functionsPassed! += suite.functionsPassed!;
        });

        test.time = totalTime;
        if (allSuitesRan && allFunctionsRan) {
            test.passed = allFunctionsPassed && allSuitesPassed;
            test.status = test.passed ? TestStatus.Idle : TestStatus.Error;
        } else {
            test.passed = undefined;
            test.status = TestStatus.Unknown;
        }
    }
}
