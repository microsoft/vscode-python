// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { test, TestItem } from 'vscode';
import { RawTest } from '../../common/services/types';

export class TestCase {
    public static create(rawData: RawTest): TestItem<TestCase> {
        const item = test.createTestItem<TestCase>({
            id: rawData.id,
            label: rawData.name,
        });

        item.debuggable = true;
        item.data = new TestCase(item, rawData);
        return item;
    }

    constructor(public readonly item: TestItem<TestCase>, public readonly raw: RawTest) {}
}
