// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { test, TestItem } from 'vscode';
import { RawTest } from '../../common/services/types';

export class TestCase {
    public static create(testRoot: string, rawData: RawTest): TestItem<TestCase> {
        const fullPath = path.join(testRoot, rawData.id);
        const item = test.createTestItem<TestCase>({
            id: fullPath,
            label: rawData.name,
        });

        item.debuggable = true;
        item.data = new TestCase(item, rawData);
        return item;
    }

    constructor(public readonly item: TestItem<TestCase>, public readonly raw: RawTest) {}
}
