// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as path from 'path';
import { CancellationTokenSource, FoldingRange, FoldingRangeKind, workspace } from 'vscode';
import { DocStringFoldingProvider } from '../../client/providers/docStringFoldingProvider';

type FileFoldingRanges = { file: string; ranges: FoldingRange[] };
const pythonFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'folding');

// tslint:disable-next-line:max-func-body-length
suite('Provider - Folding Provider', () => {
    const docStringFileAndExpectedFoldingRanges: FileFoldingRanges[] = [
        {
            file: path.join(pythonFilesPath, 'attach_server.py'),
            ranges: [
                new FoldingRange(0, 14),
                new FoldingRange(44, 73, FoldingRangeKind.Comment),
                new FoldingRange(98, 146),
                new FoldingRange(152, 153, FoldingRangeKind.Comment),
                new FoldingRange(312, 320),
                new FoldingRange(327, 329)
            ]
        },
        {
            file: path.join(pythonFilesPath, 'visualstudio_ipython_repl.py'),
            ranges: [
                new FoldingRange(0, 14),
                new FoldingRange(78, 79, FoldingRangeKind.Comment),
                new FoldingRange(81, 82, FoldingRangeKind.Comment),
                new FoldingRange(92, 93, FoldingRangeKind.Comment),
                new FoldingRange(108, 109, FoldingRangeKind.Comment),
                new FoldingRange(139, 140, FoldingRangeKind.Comment),
                new FoldingRange(169, 170, FoldingRangeKind.Comment),
                new FoldingRange(275, 277, FoldingRangeKind.Comment),
                new FoldingRange(319, 320, FoldingRangeKind.Comment)
            ]
        },
        {
            file: path.join(pythonFilesPath, 'visualstudio_py_debugger.py'),
            ranges: [
                new FoldingRange(0, 15, FoldingRangeKind.Comment),
                new FoldingRange(22, 25, FoldingRangeKind.Comment),
                new FoldingRange(47, 48, FoldingRangeKind.Comment),
                new FoldingRange(69, 70, FoldingRangeKind.Comment),
                new FoldingRange(96, 97, FoldingRangeKind.Comment),
                new FoldingRange(105, 106, FoldingRangeKind.Comment),
                new FoldingRange(141, 142, FoldingRangeKind.Comment),
                new FoldingRange(149, 162, FoldingRangeKind.Comment),
                new FoldingRange(165, 166, FoldingRangeKind.Comment),
                new FoldingRange(207, 208, FoldingRangeKind.Comment),
                new FoldingRange(235, 237, FoldingRangeKind.Comment),
                new FoldingRange(240, 241, FoldingRangeKind.Comment),
                new FoldingRange(300, 301, FoldingRangeKind.Comment),
                new FoldingRange(334, 335, FoldingRangeKind.Comment),
                new FoldingRange(346, 348, FoldingRangeKind.Comment),
                new FoldingRange(499, 500, FoldingRangeKind.Comment),
                new FoldingRange(558, 559, FoldingRangeKind.Comment),
                new FoldingRange(602, 604, FoldingRangeKind.Comment),
                new FoldingRange(608, 609, FoldingRangeKind.Comment),
                new FoldingRange(612, 614, FoldingRangeKind.Comment),
                new FoldingRange(637, 638, FoldingRangeKind.Comment)
            ]
        },
        {
            file: path.join(pythonFilesPath, 'visualstudio_py_repl.py'),
            ranges: []
        }
    ];

    docStringFileAndExpectedFoldingRanges.forEach(item => {
        test(`Test Docstring folding regions '${path.basename(item.file)}'`, async () => {
            const document = await workspace.openTextDocument(item.file);
            const provider = new DocStringFoldingProvider();
            const ranges = await provider.provideFoldingRanges(document, {}, new CancellationTokenSource().token);
            expect(ranges).to.be.lengthOf(item.ranges.length);
            ranges!.forEach(range => {
                const index = item.ranges.findIndex(
                    searchItem => searchItem.start === range.start && searchItem.end === range.end
                );
                expect(index).to.be.greaterThan(-1, `${range.start}, ${range.end} not found`);
            });
        });
    });
});
