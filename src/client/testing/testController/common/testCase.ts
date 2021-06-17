// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Position, Range, test, TestItem, Uri } from 'vscode';
import { RawTest } from '../../common/services/types';

export class TestCase {
    public static create(testRoot: string, rawData: RawTest): TestItem<TestCase> {
        const fullId = path.join(testRoot, rawData.id);
        const documentPath = path.join(testRoot, rawData.source.substr(0, rawData.source.indexOf(':')));
        const item = test.createTestItem<TestCase>({
            id: fullId,
            label: rawData.name,
            uri: Uri.file(documentPath),
        });

        item.debuggable = true;
        item.data = new TestCase(item, rawData);

        try {
            const sourceLine = rawData.source.substr(rawData.source.indexOf(':') + 1);
            const line = parseInt(sourceLine, 10);
            // Lines in raw data start at 1, vscode lines start at 0
            item.range = new Range(new Position(line - 1, 0), new Position(line, 0));
        } catch (ex) {
            // ignore
        }

        return item;
    }

    constructor(public readonly item: TestItem<TestCase>, public readonly raw: RawTest) {}
}
