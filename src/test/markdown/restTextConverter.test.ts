// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-extra';
import * as path from 'path';
import { RestTextConverter } from '../../client/common/markdown/restTextConverter';
import { compareFiles } from '../textUtils';

const srcPythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'markdown');

async function testConversion(fileName: string): Promise<void> {
    const cvt = new RestTextConverter();
    const file = path.join(srcPythoFilesPath, fileName);
    const source = await fs.readFile(`${file}.pydoc`, 'utf8');
    const actual = cvt.toMarkdown(source);
    const expected = await fs.readFile(`${file}.md`, 'utf8');
    compareFiles(expected, actual);
}

// tslint:disable-next-line:max-func-body-length
suite('Hover - RestTextConverter', () => {
    test('scipy', async () => testConversion('scipy'));
    test('scipy.spatial', async () => testConversion('scipy.spatial'));
    test('scipy.spatial.distance', async () => testConversion('scipy.spatial.distance'));
    test('anydbm', async () => testConversion('anydbm'));
    test('aifc', async () => testConversion('aifc'));
    test('astroid', async () => testConversion('astroid'));
});
