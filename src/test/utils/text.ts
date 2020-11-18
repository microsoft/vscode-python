// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { getDedentedLines, getIndent } from '../testing/helper';

/**
 * Extract a tree based on the given text.
 *
 * The tree is derived from the indent level of each line.  The caller
 * is responsible for applying any meaning to the text of each node
 * in the tree.
 *
 * Blank lines and comments (with a leading `#`) are ignored.  Also,
 * the full text is automatically dedented until at least one line
 * has no indent (i.e. is treated as a root).
 *
 * @returns - the list of nodes in the tree (pairs of text & parent index)
 *            (note that the parent index of roots is `-1`)
 *
 * Example:
 *
 *   parseTree(`
 *      # This comment and the following blank line are ignored.
 *
 *      this is a root
 *        the first branch
 *          a sub-branch  # This comment is ignored.
 *            this is the first leaf node!
 *          another leaf node...
 *          middle
 *
 *        the second main branch
 *            # indents do not have to be consistent across the full text.
 *           # ...and the indent of comments is not relevant.
 *            node 1
 *            node 2
 *
 *        the last leaf node!
 *
 *      another root
 *        nothing to see here!
 *
 *      # this comment is ignored
 *   `.trim())
 *
 * would produce the following:
 *
 *   [
 *       ['this is a root', -1],
 *       ['the first branch', 0],
 *       ['a sub-branch', 1],
 *       ['this is the first leaf node!', 2],
 *       ['another leaf node...', 1],
 *       ['middle', 1],
 *       ['the second main branch', 0],
 *       ['node 1', 6],
 *       ['node 2', 6],
 *       ['the last leaf node!', 0],
 *       ['another root', -1],
 *       ['nothing to see here!', 10],
 *   ]
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
