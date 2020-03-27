// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { TestDataItem } from '../../types';
import { visitRecursive } from '../testVisitors/visitor';
import { ITestCollectionStorageService, ITestsStatusUpdaterService, Tests, TestStatus, TestsToRun } from '../types';

@injectable()
export class TestsStatusUpdaterService implements ITestsStatusUpdaterService {
    constructor(@inject(ITestCollectionStorageService) private readonly storage: ITestCollectionStorageService) {}
    public updateStatusAsDiscovering(resource: Uri, tests?: Tests): void {
        if (!tests) {
            return;
        }
        const visitor = (item: TestDataItem) => {
            item.status = TestStatus.Discovering;
            this.storage.update(resource, item);
        };
        tests.rootTestFolders.forEach((item) => visitRecursive(tests, item, visitor));
    }
    public updateStatusAsUnknown(resource: Uri, tests?: Tests): void {
        if (!tests) {
            return;
        }
        const visitor = (item: TestDataItem) => {
            item.status = TestStatus.Unknown;
            this.storage.update(resource, item);
        };
        tests.rootTestFolders.forEach((item) => visitRecursive(tests, item, visitor));
    }
    public updateStatusAsRunning(resource: Uri, tests?: Tests): void {
        if (!tests) {
            return;
        }
        const visitor = (item: TestDataItem) => {
            item.status = TestStatus.Running;
            this.storage.update(resource, item);
        };
        tests.rootTestFolders.forEach((item) => visitRecursive(tests, item, visitor));
    }
    public updateStatusAsRunningFailedTests(resource: Uri, tests?: Tests): void {
        if (!tests) {
            return;
        }
        const predicate = (item: TestDataItem) => item.status === TestStatus.Fail || item.status === TestStatus.Error;
        const visitor = (item: TestDataItem) => {
            if (item.status && predicate(item)) {
                item.status = TestStatus.Running;
                this.storage.update(resource, item);
            }
        };
        const failedItems = [
            ...tests.testFunctions.map((f) => f.testFunction).filter(predicate),
            ...tests.testSuites.map((f) => f.testSuite).filter(predicate),
        ];
        failedItems.forEach((failedItem) => visitRecursive(tests, failedItem, visitor));
    }
    public updateStatusAsRunningSpecificTests(resource: Uri, testsToRun: TestsToRun, tests?: Tests): void {
        if (!tests) {
            return;
        }
        const itemsRunning = [
            ...(testsToRun.testFile || []),
            ...(testsToRun.testSuite || []),
            ...(testsToRun.testFunction || []),
        ];
        const visitor = (item: TestDataItem) => {
            item.status = TestStatus.Running;
            this.storage.update(resource, item);
        };
        itemsRunning.forEach((item) => visitRecursive(tests, item, visitor));
    }
    public updateStatusOfRunningTestsAsIdle(resource: Uri, tests?: Tests): void {
        if (!tests) {
            return;
        }
        const visitor = (item: TestDataItem) => {
            if (item.status === TestStatus.Running) {
                item.status = TestStatus.Idle;
                this.storage.update(resource, item);
            }
        };
        tests.rootTestFolders.forEach((item) => visitRecursive(tests, item, visitor));
    }
    public triggerUpdatesToTests(resource: Uri, tests?: Tests): void {
        if (!tests) {
            return;
        }
        const visitor = (item: TestDataItem) => this.storage.update(resource, item);
        tests.rootTestFolders.forEach((item) => visitRecursive(tests, item, visitor));
    }
}
