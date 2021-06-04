// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { test, TestItem, Uri } from 'vscode';
import { RawTestFolder } from '../../common/services/types';
import { TestFile } from '../../common/types';

export class TestFolder {
    public static create(testRoot: string, rawData: RawTestFolder): TestItem<TestFolder, TestFolder | TestFile> {
        const fullPath = path.join(testRoot, rawData.relpath);
        const item = test.createTestItem<TestFolder, TestFolder | TestFile>({
            id: fullPath,
            label: path.basename(fullPath),
            uri: Uri.file(fullPath),
        });

        item.debuggable = true;
        item.data = new TestFolder(item, rawData);
        return item;
    }

    constructor(
        public readonly item: TestItem<TestFolder, TestFolder | TestFile>,
        public readonly raw: RawTestFolder,
    ) {}
}
