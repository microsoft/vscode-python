// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Position, Range, test, TestItem, Uri } from 'vscode';
import { RawTest } from '../../common/services/types';

/**
 * This class represents the leaf node in the test view.
 */
export class TestCase {
    public static create(testRoot: string, rawData: RawTest): TestItem<TestCase> {
        // fullId can look like test_something.py::SomeClass::someTest[x1]
        const fullId = path.join(testRoot, rawData.id);

        // We need the actual document path so we can set the location for the tests. This will be
        // used to provide test result status next to the tests.
        const documentPath = path.join(testRoot, rawData.source.substr(0, rawData.source.indexOf(':')));

        const item = test.createTestItem<TestCase>({
            id: fullId,
            label: rawData.name,
            uri: Uri.file(documentPath),
        });

        // This is the id that will be used to compare with the results from JUnit file.
        const runId = rawData.id
            .replace(/[\\\:\/]/g, '.')
            .replace(/\:\:/g, '.')
            .replace(/\.\./g, '.')
            .replace(/\.py/g, '');

        item.debuggable = true;
        item.data = new TestCase(item, rawData, runId);

        // We have to extract the line number from the source data. If it is available it
        // saves us from running symbol script or querying language server for this info.
        try {
            const sourceLine = rawData.source.substr(rawData.source.indexOf(':') + 1);
            const line = Number.parseInt(sourceLine, 10);
            // Lines in raw data start at 1, vscode lines start at 0
            item.range = new Range(new Position(line - 1, 0), new Position(line, 0));
        } catch (ex) {
            // ignore
        }

        return item;
    }

    constructor(
        public readonly item: TestItem<TestCase>,
        public readonly raw: RawTest,
        public readonly runId: string,
    ) {}
}
