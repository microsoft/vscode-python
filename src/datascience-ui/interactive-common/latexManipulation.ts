// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-require-imports no-var-requires
const _escapeRegExp = require('lodash/escapeRegExp') as typeof import('lodash/escapeRegExp');

// Adds '$$' to single latex formulas that don't have a '$', allowing users to input the formula directly.

export function fixLatexEquations(input: string): string {
    const begin = /\\begin\{([a-z,\*]+)\}/.exec(input);

    if (begin && begin.index === 0) {
        const endRegex = new RegExp(`\\\\end\\{${_escapeRegExp(begin[1])}\\}`);
        const end = endRegex.exec(input);

        if (end && end.index + end[0].length === input.length) {
            const prefix = '$$\n';
            const postfix = '\n$$';
            return prefix + input + postfix;
        }
    }

    return input;
}
