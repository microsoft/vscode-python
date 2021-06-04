// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { test, TestItem, Uri } from 'vscode';
import { RawTestFile } from '../../common/services/types';
import { TestCase } from './testCase';
import { TestCollection } from './testCollection';

export class TestFile {
    public static create(testRoot: string, rawData: RawTestFile): TestItem<TestFile, TestCollection | TestCase> {
        const fullPath = path.join(testRoot, rawData.relpath);
        const item = test.createTestItem<TestFile, TestCollection | TestCase>({
            id: fullPath,
            label: path.basename(fullPath),
            uri: Uri.file(fullPath),
        });

        item.debuggable = true;
        item.data = new TestFile(item, rawData);
        return item;
    }

    constructor(
        public readonly item: TestItem<TestFile, TestCollection | TestCase>,
        public readonly raw: RawTestFile,
    ) {}
}
