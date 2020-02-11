// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-require-imports no-var-requires
const _escapeRegExp = require('lodash/escapeRegExp') as typeof import('lodash/escapeRegExp');

// Adds '$$' to latex formulas that don't have a '$', allowing users to input the formula directly.
//
// The general algorithm here is:
// Search for either $$ or $ or a \begin{name} item.
// If a $$ or $ is found, output up to the next dollar sign
// If a \begin{name} is found, find the matching \end{name}, wrap the section in $$ and output up to the \end.
//
// LaTeX seems to follow the pattern of \begin{name} or is escaped with $$ or $. See here for a bunch of examples:
// https://jupyter-notebook.readthedocs.io/en/stable/examples/Notebook/Typesetting%20Equations.html
export function fixLatexEquations(input: string, wrapSingles: boolean = false): string {
    const output: string[] = [];

    // Search for begin/end pairs, outputting as we go
    let start = 0;

    // Loop until we run out string
    while (start < input.length) {
        // Check $$, $ and begin
        const dollars = /\$\$/.exec(input.substr(start));
        const dollar = /\$/.exec(input.substr(start));
        const begin = /\\begin\{([a-z,\*]+)\}/.exec(input.substr(start));
        let endRegex = /\$\$/;
        let endRegexLength = 2;

        // Pick the first that matches
        let match = dollars;
        let isBeginMatch = false;
        const isDollarsMatch = dollars?.index === dollar?.index;
        if (!match || (dollar && dollar.index < match.index)) {
            match = dollar;
            endRegex = /\$/;
            endRegexLength = 1;
        }
        if (!match || (begin && begin.index < match.index)) {
            match = begin;
            endRegex = begin ? new RegExp(`\\\\end\\{${_escapeRegExp(begin[1])}\\}`) : /\$/;
            endRegexLength = begin ? `\\end{${begin[1]}}`.length : 1;
            isBeginMatch = true;
        }

        // Output this match
        if (match) {
            if (isBeginMatch) {
                // Begin match is a little more complicated.
                const offset = match.index + start;
                const end = endRegex.exec(input.substr(start));
                if (end) {
                    const prefix = input.substr(start, match.index);
                    const wrapped = input.substr(offset, endRegexLength + end.index - match.index);
                    output.push(`${prefix}\n$$\n${wrapped}\n$$\n`);
                    start = start + prefix.length + wrapped.length;
                } else {
                    // Invalid, just return
                    return input;
                }
            } else if (isDollarsMatch) {
                // Output till the next $$
                const offset = match.index + 2 + start;
                const endDollar = endRegex.exec(input.substr(offset));
                if (endDollar) {
                    const length = endDollar.index + 2;
                    const before = input.substr(start, offset - start);
                    const after = input.substr(offset, length);
                    output.push(`${before}${after}`);
                    start = offset + length;
                } else {
                    // Invalid, just return
                    return input;
                }
            } else {
                // Output till the next $ (wrapping in an extra $ so it works with latex cells too)
                const offset = match.index + 1 + start;
                const endDollar = endRegex.exec(input.substr(offset));
                if (endDollar) {
                    const length = endDollar.index + 1;
                    const before = input.substr(start, offset - start);
                    const after = input.substr(offset, length);
                    output.push(wrapSingles ? `${before}$${after}$` : `${before}${after}`);
                    start = offset + length;
                } else {
                    // Invalid, just return
                    return input;
                }
            }
        } else {
            // No more matches
            output.push(input.substr(start));
            start = input.length;
        }
    }
    return output.join('');
}
