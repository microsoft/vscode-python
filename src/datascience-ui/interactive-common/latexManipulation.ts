// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-require-imports no-var-requires
const _escapeRegExp = require('lodash/escapeRegExp') as typeof import('lodash/escapeRegExp');

function appendMatch(input: string)

// Adds '$$' to latex formulas that don't have a '$', allowing users to input the formula directly.
export function fixLatexEquations(input: string): string {
    const output: string[] = [];

    // Search for begin/end pairs, outputting as we go
    let start = 0;
    const appendMatch = (beginIndex: endRegex: RegExp, beginIndex: number)
    while (start < input.length) {
        // First $$
        const startDollars = /\$\$/.exec(input.substr(start));
        // Then $
        const startDollar = /\$/.exec(input.substr(start));
        // Then /begin{name*}
        const begin = /\\begin\{([a-z,\*]+)\}/.exec(input.substr(start));
        if (startDollars && startDollars.index < begin.index) {
            // Output till the next $$
            const offset = startDollars.index + 1 + start;
            const endDollars = /\$\$/.exec(input.substr(offset));
            if (endDollars) {
                const length = endDollars.index + 2 + offset;
                output.push(input.substr(start, length));
                start = start + length;
            } else {
                // Invalid, just return
                return input;
            }
        } else if (startDollar) {
            // Output till the next $
            const offset = startDollar.index + 1 + start;
            const endDollar = /\$/.exec(input.substr(offset));
            if (endDollar) {
                const length = endDollar.index + 1 + offset;
                output.push(input.substr(start, length));
                start = start + length;
            } else {
                // Invalid, just return
                return input;
            }
        } else if (begin && begin.length > 1) {
            const offset = begin.index + start;
            const endRegex = new RegExp(`\\\\end\\{${_escapeRegExp(begin[1])}\\}`);
            const end = endRegex.exec(input.substr(start));
            if (end) {
                const prefix = input.substr(start, begin.index);
                const wrapped = input.substr(offset, `\\end{${begin[1]}}`.length + end.index - begin.index);
                output.push(`${prefix}\n$$\n${wrapped}\n$$\n`);
                start = start + prefix.length + wrapped.length;
            } else {
                // Invalid, just return
                return input;
            }
        } else {
            output.push(input.substr(start));
            start = input.length;
        }
    }
    return output.join('');
}
