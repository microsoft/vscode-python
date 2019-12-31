import { inject, injectable, named } from 'inversify';
import { TestDataItem, TestDataItemType } from '../../types';
import { getChildren, getTestDataItemType } from '../testUtils';
import { ITestResultsService, ITestVisitor, Tests, TestStatus } from '../types';

@injectable()
export class TestResultsService implements ITestResultsService {
    constructor(@inject(ITestVisitor) @named('TestResultResetVisitor') private resultResetVisitor: ITestVisitor) {}
    public resetResults(tests: Tests): void {
        tests.testFolders.forEach(f => this.resultResetVisitor.visitTestFolder(f));
        tests.testFunctions.forEach(fn => this.resultResetVisitor.visitTestFunction(fn.testFunction));
        tests.testSuites.forEach(suite => this.resultResetVisitor.visitTestSuite(suite.testSuite));
        tests.testFiles.forEach(testFile => this.resultResetVisitor.visitTestFile(testFile));
    }
    public updateResults(tests: Tests): void {
        // Update Test tree bottom to top
        const testQueue: TestDataItem[] = [];
        const testStack: TestDataItem[] = [];
        tests.rootTestFolders.forEach(folder => testQueue.push(folder));

        while (testQueue.length > 0) {
            const item = testQueue.shift();
            if (!item) {
                continue;
            }
            testStack.push(item);
            const children = getChildren(item);
            children.forEach(child => testQueue.push(child));
        }
        while (testStack.length > 0) {
            const item = testStack.pop();
            this.updateTestItem(item!);
        }
    }
    private updateTestItem(test: TestDataItem): void {
        if (getTestDataItemType(test) === TestDataItemType.function) {
            return;
        }
        let allChildrenPassed = true;
        let noChildrenRan = true;
        test.functionsPassed = test.functionsFailed = test.functionsDidNotRun = 0;

        const children = getChildren(test);
        children.forEach(child => {
            if (getTestDataItemType(child) === TestDataItemType.function) {
                if (typeof child.passed === 'boolean') {
                    noChildrenRan = false;
                    if (child.passed) {
                        test.functionsPassed! += 1;
                    } else {
                        test.functionsFailed! += 1;
                        allChildrenPassed = false;
                    }
                } else {
                    test.functionsDidNotRun! += 1;
                }
            } else {
                if (typeof child.passed === 'boolean') {
                    noChildrenRan = false;
                    if (!child.passed) {
                        allChildrenPassed = false;
                    }
                }
                test.functionsFailed! += child.functionsFailed!;
                test.functionsPassed! += child.functionsPassed!;
                test.functionsDidNotRun! += child.functionsDidNotRun!;
            }
        });
        if (noChildrenRan) {
            test.passed = undefined;
            test.status = TestStatus.Unknown;
        } else {
            test.passed = allChildrenPassed;
            test.status = test.passed ? TestStatus.Pass : TestStatus.Fail;
        }
    }
}
