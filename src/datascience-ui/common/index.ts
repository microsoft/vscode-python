// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import { noop } from '../../client/common/utils/misc';

const SingleQuoteMultiline = "'''";
const DoubleQuoteMultiline = '"""';

function concatMultilineString(str: nbformat.MultilineString, trim: boolean): string {
    const nonLineFeedWhiteSpaceTrim = /(^[\t\f\v\r ]+|[\t\f\v\r ]+$)/g; // Local var so don't have to reset the lastIndex.
    if (Array.isArray(str)) {
        let result = '';
        for (let i = 0; i < str.length; i += 1) {
            const s = str[i];
            if (i < str.length - 1 && !s.endsWith('\n')) {
                result = result.concat(`${s}\n`);
            } else {
                result = result.concat(s);
            }
        }

        // Just trim whitespace. Leave \n in place
        return trim ? result.replace(nonLineFeedWhiteSpaceTrim, '') : result;
    }
    return trim ? str.toString().replace(nonLineFeedWhiteSpaceTrim, '') : str.toString();
}

export function concatMultilineStringOutput(str: nbformat.MultilineString): string {
    return concatMultilineString(str, true);
}
export function concatMultilineStringInput(str: nbformat.MultilineString): string {
    return concatMultilineString(str, false);
}

export function splitMultilineString(source: nbformat.MultilineString): string[] {
    // Make sure a multiline string is back the way Jupyter expects it
    if (Array.isArray(source)) {
        return source as string[];
    }
    const str = source.toString();
    if (str.length > 0) {
        // Each line should be a separate entry, but end with a \n if not last entry
        const arr = str.split('\n');
        return arr
            .map((s, i) => {
                if (i < arr.length - 1) {
                    return `${s}\n`;
                }
                return s;
            })
            .filter(s => s.length > 0); // Skip last one if empty (it's the only one that could be length 0)
    }
    return [];
}

// Strip out comment lines from code
export function stripComments(str: string): string {
    let result: string = '';
    parseForComments(
        str.splitLines({ trim: false, removeEmptyEntries: false }),
        _s => noop,
        s => (result = result.concat(`${s}\n`))
    );
    return result;
}

// Took this from jupyter/notebook
// https://github.com/jupyter/notebook/blob/b8b66332e2023e83d2ee04f83d8814f567e01a4e/notebook/static/base/js/utils.js
// Remove characters that are overridden by backspace characters
function fixBackspace(txt: string) {
    let tmp = txt;
    do {
        txt = tmp;
        // Cancel out anything-but-newline followed by backspace
        tmp = txt.replace(/[^\n]\x08/gm, '');
    } while (tmp.length < txt.length);
    return txt;
}

// Using our own version for fixCarriageReturn. The jupyter version seems to not work.
function fixCarriageReturn(str: string): string {
    // Go through the string, looking for \r's that are not followed by \n. This is
    // a special case that means replace the string before. This is necessary to
    // get an html display of this string to behave correctly.

    // Note: According to this:
    // https://jsperf.com/javascript-concat-vs-join/2.
    // Concat is way faster than array join for building up a string.
    let result = '';
    let previousLinePos = 0;
    for (let i = 0; i < str.length; i += 1) {
        if (str[i] === '\r') {
            // See if this is a line feed. If so, leave alone. This is goofy windows \r\n
            if (i < str.length - 1 && str[i + 1] === '\n') {
                // This line is legit, output it and convert to '\n' only.
                result += str.substr(previousLinePos, i - previousLinePos);
                result += '\n';
                previousLinePos = i + 2;
                i += 1;
            } else {
                // This line should replace the previous one. Skip our \r
                previousLinePos = i + 1;
            }
        } else if (str[i] === '\n') {
            // This line is legit, output it. (Single linefeed)
            result += str.substr(previousLinePos, i - previousLinePos + 1);
            previousLinePos = i + 1;
        }
    }
    result += str.substr(previousLinePos, str.length - previousLinePos);
    return result;
}

export function formatStreamText(str: string): string {
    // Do the same thing jupyter is doing
    return fixCarriageReturn(fixBackspace(str));
}

export function appendLineFeed(arr: string[], modifier?: (s: string) => string) {
    return arr.map((s: string, i: number) => {
        const out = modifier ? modifier(s) : s;
        return i === arr.length - 1 ? `${out}` : `${out}\n`;
    });
}

export function generateMarkdownFromCodeLines(lines: string[]) {
    // Generate markdown by stripping out the comments and markdown header
    return appendLineFeed(extractComments(lines.slice(1)));
}

// tslint:disable-next-line: cyclomatic-complexity
export function parseForComments(lines: string[], foundCommentLine: (s: string, i: number) => void, foundNonCommentLine: (s: string, i: number) => void) {
    // Check for either multiline or single line comments
    let insideMultilineComment: string | undefined;
    let insideMultilineQuote: string | undefined;
    let pos = 0;
    for (const l of lines) {
        const trim = l.trim();
        // Multiline is triple quotes of either kind
        const isMultilineComment = trim.startsWith(SingleQuoteMultiline) ? SingleQuoteMultiline : trim.startsWith(DoubleQuoteMultiline) ? DoubleQuoteMultiline : undefined;
        const isMultilineQuote = trim.includes(SingleQuoteMultiline) ? SingleQuoteMultiline : trim.includes(DoubleQuoteMultiline) ? DoubleQuoteMultiline : undefined;

        // Check for ending quotes of multiline string
        if (insideMultilineQuote) {
            if (insideMultilineQuote === isMultilineQuote) {
                insideMultilineQuote = undefined;
            }
            foundNonCommentLine(l, pos);
            // Not inside quote, see if inside a comment
        } else if (insideMultilineComment) {
            if (insideMultilineComment === isMultilineComment) {
                insideMultilineComment = undefined;
            }
            if (insideMultilineComment) {
                foundCommentLine(l, pos);
            }
            // Not inside either, see if starting a quote
        } else if (isMultilineQuote && !isMultilineComment) {
            // Make sure doesn't begin and end on the same line.
            const beginQuote = trim.indexOf(isMultilineQuote);
            const endQuote = trim.lastIndexOf(isMultilineQuote);
            insideMultilineQuote = endQuote !== beginQuote ? undefined : isMultilineQuote;
            foundNonCommentLine(l, pos);
            // Not starting a quote, might be starting a comment
        } else if (isMultilineComment) {
            // See if this line ends the comment too or not
            const endIndex = trim.indexOf(isMultilineComment, 3);
            insideMultilineComment = endIndex >= 0 ? undefined : isMultilineComment;

            // Might end with text too
            if (trim.length > 3) {
                foundCommentLine(trim.slice(3, endIndex >= 0 ? endIndex : undefined), pos);
            }
        } else {
            // Normal line
            if (trim.startsWith('#')) {
                foundCommentLine(trim.slice(1), pos);
            } else {
                foundNonCommentLine(l, pos);
            }
        }
        pos += 1;
    }
}

function extractComments(lines: string[]): string[] {
    const result: string[] = [];
    parseForComments(
        lines,
        s => result.push(s),
        _s => noop()
    );
    return result;
}
