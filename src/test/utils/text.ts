// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { getDedentedLines, getIndent } from '../testing/helper';

/**
 * Extract a tree based on the given text.
 *
 * The tree is derived from the indent level of each line.
 */
export function parseTree(text: string): [string, number][] {
    const parsed: [string, number][] = [];
    const parents: [string, number][] = [];

    const lines = getDedentedLines(text)
        .map((l) => l.split('  #')[0].split(' //')[0].trimEnd())
        .filter((l) => l.trim() !== '');
    lines.forEach((line) => {
        const indent = getIndent(line);
        const entry = line.trim();

        let parentIndex: number;
        if (indent === '') {
            parentIndex = -1;
            parents.push([indent, parsed.length]);
        } else if (parsed.length === 0) {
            throw Error(`expected non-indented line, got ${line}`);
        } else {
            let parentIndent: string;
            [parentIndent, parentIndex] = parents[parents.length - 1];
            while (indent.length <= parentIndent.length) {
                parents.pop();
                [parentIndent, parentIndex] = parents[parents.length - 1];
            }
            if (parentIndent.length < indent.length) {
                parents.push([indent, parsed.length]);
            }
        }
        parsed.push([entry, parentIndex!]);
    });

    return parsed;
}
