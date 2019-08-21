// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/* Generate a RegExp from a "verbose" pattern.
 *
 * All whitespace in the pattern is removed, including newlines.  This
 * allows the pattern to be much more readable by allowing it to span
 * multiple lines and to separate tokens with insignificant whitespace.
 * The functionality is similar to the VERBOSE ("x") flag in Python's
 * regular expressions.
 *
 * Note that significant whitespace in the pattern must be explicitly
 * indicated by "\s".  Also, unlike with regular expression literals,
 * backslashes must be escaped.  Conversely, forward slashes do not
 * need to be escaped.
 */
export function verboseRegExp(pattern: string): RegExp {
    pattern = pattern.replace(/\s+?/g, '');
    return RegExp(pattern);
}
