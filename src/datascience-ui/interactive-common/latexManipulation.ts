// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Adds '$$' to latex formulas that don't have a '$', allowing users to input the formula directly.
export function fixLatexEquations(input: string): string {
    const block = '\n$$\n';

    const beginIndexes = getAllIndexesOfRegex(input, /\\begin\{[a-z]*\*?\}/g);
    const endIndexes = getAllIndexesOfRegex(input, /\\end\{[a-z]*\*?\}/g);

    if (beginIndexes.length === endIndexes.length) {
        for (let i = 0; i < beginIndexes.length; i += 1) {
            const endOfEnd = input.indexOf('}', endIndexes[i] + 1 + 8 * i);

            // Edge case, if the input starts with the latex formula we add the block at the beggining.
            if (beginIndexes[i] === 0 && input[beginIndexes[i]] === '\\') {
                input = block + input.slice(0, endOfEnd + 1) + block + input.slice(endOfEnd + 1, input.length);
                // Normal case, if the latex formula starts with a '$' we don't do anything.
                // Otherwise, we insert the block at the beginning and ending of the latex formula.
            } else if (input[beginIndexes[i] - 1] !== '$') {
                input = input.slice(0, beginIndexes[i] + block.length * 2 * i) + block + input.slice(beginIndexes[i] + block.length * 2 * i, endOfEnd + 1) + block + input.slice(endOfEnd + 1, input.length);
            }
        }
    }

    return input;
}

function getAllIndexesOfRegex(arr: string, value: RegExp): number[] {
    const indexes = [];
    let result;

    // tslint:disable-next-line: no-conditional-assignment
    while ((result = value.exec(arr)) !== null) {
        indexes.push(result.index);
    }

    return indexes;
}
