// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { test, TestItem } from 'vscode';
import { RawTestFunction, RawTestSuite } from '../../common/services/types';
import { TestCase } from './testCase';

export class TestCollection {
    public static create(
        testRoot: string,
        rawData: RawTestSuite | RawTestFunction,
    ): TestItem<TestCollection, TestCollection | TestCase> {
        const fullPath = path.join(testRoot, rawData.id);
        const item = test.createTestItem<TestCollection, TestCollection | TestCase>({
            id: fullPath,
            label: rawData.name,
        });

        item.debuggable = true;
        item.data = new TestCollection(item, rawData);
        return item;
    }

    constructor(
        public readonly item: TestItem<TestCollection, TestCollection | TestCase>,
        public readonly raw: RawTestSuite | RawTestFunction,
    ) {}
}
