import { inject, injectable, named } from 'inversify';
import { TestDataItem } from '../../types';
import { visitParentsRecursive } from '../testVisitors/visitor';
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
        tests.rootTestFolders.forEach(folder => this.updateTestFolderResults(folder));
        // List items should be updated in order
        [TestStatus.Pass, TestStatus.Fail].forEach(item => this.updateParentStatus(tests, item));
    }
    private updateTestSuiteResults(test: TestSuite): void {
        this.updateTestSuiteAndFileResults(test);
    }
    private updateTestFileResults(test: TestFile): void {
        this.updateTestSuiteAndFileResults(test);
    }
    private updateParentStatus(tests: Tests, status: TestStatus): void {
        const visitor = (item: TestDataItem) => {
            item.status = status;
        };
        tests.testFiles.forEach(item => {
            if (typeof item.passed === 'boolean') {
                if (status === TestStatus.Pass ? item.passed : !item.passed) {
                    visitParentsRecursive(tests, item, visitor);
                }
            }
        });
    }
    private updateTestFolderResults(testFolder: TestFolder): void {
        let totalTime = 0;
        let allFilesPassed = true;
        let allFilesSkipped = true;

        testFolder.testFiles.forEach(fl => {
            totalTime += fl.time;
            if (typeof fl.passed === 'boolean') {
                allFilesSkipped = false;
                if (!fl.passed) {
                    allFilesPassed = false;
                }
            }

            testFolder.functionsFailed! += fl.functionsFailed!;
            testFolder.functionsPassed! += fl.functionsPassed!;
        });

        let allFoldersPassed = true;
        let allFoldersSkipped = true;

        testFolder.folders.forEach(folder => {
            totalTime += folder.time;
            this.updateTestFolderResults(folder);
            if (typeof folder.passed === 'boolean') {
                allFoldersSkipped = false;
                if (!folder.passed) {
                    allFoldersPassed = false;
                }
            }

            testFolder.functionsFailed! += folder.functionsFailed!;
            testFolder.functionsPassed! += folder.functionsPassed!;
        });

        testFolder.time = totalTime;
        if (allFilesSkipped && allFoldersSkipped) {
            testFolder.passed = undefined;
            testFolder.status = TestStatus.Unknown;
        } else {
            testFolder.passed = allFilesPassed && allFoldersPassed;
            testFolder.status = testFolder.passed ? TestStatus.Pass : TestStatus.Fail;
        }
    }
    private updateTestSuiteAndFileResults(test: TestSuite | TestFile): void {
        let totalTime = 0;
        let allFunctionsPassed = true;
        let allFunctionsSkipped = true;

        test.functions.forEach(fn => {
            totalTime += fn.time;
            if (typeof fn.passed === 'boolean') {
                allFunctionsSkipped = false;
                if (fn.passed) {
                    test.functionsPassed! += 1;
                } else {
                    test.functionsFailed! += 1;
                    allFunctionsPassed = false;
                }
            }
        });

        let allSuitesPassed = true;
        let allSuitesSkipped = true;

        test.suites.forEach(suite => {
            this.updateTestSuiteResults(suite);
            totalTime += suite.time;
            if (typeof suite.passed === 'boolean') {
                allSuitesSkipped = false;
                if (!suite.passed) {
                    allSuitesPassed = false;
                }
            }

            test.functionsFailed! += suite.functionsFailed!;
            test.functionsPassed! += suite.functionsPassed!;
        });

        test.time = totalTime;
        if (allSuitesSkipped && allFunctionsSkipped) {
            test.passed = undefined;
            test.status = TestStatus.Unknown;
        } else {
            test.passed = allFunctionsPassed && allSuitesPassed;
            test.status = test.passed ? TestStatus.Pass : TestStatus.Error;
        }
    }
}
