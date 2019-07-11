// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IndentAction } from 'vscode';

export const MULTILINE_SEPARATOR_INDENT_REGEX = /^(?!\s+\\)[^#\n]+\\$/;
/**
 * This does not handle all cases. However, it does handle nearly all usage.
 * Here's what it does not cover:
 * - the statement is split over multiple lines (and hence the ":" is on a different line)
 * - the code block is inlined (after the ":")
 * - there are multiple statements on the line (separated by semicolons)
 * Also note that `lambda` is purposefully excluded.
 */
export const INCREASE_INDENT_REGEX = /^\s*(?:(?:async|class|def|elif|except|for|if|while|with)\b.*|(else|finally|try))\s*:\s*(#.*)?$/;
export const DECREASE_INDENT_REGEX = /^\s*(?:else|finally|(?:elif|except)\b.*)\s*:\s*(#.*)?$/;
export const OUTDENT_SINGLE_KEYWORD_REGEX = /^\s*(break|continue|pass|raise\b.*)\s*(#.*)?$/;
/**
 * Dedent the line following a return statement only if there is no dangling open array, tuple or dictionary before the cursor.
 * A line with a closed array, tuple or dictionary will be dedented correctly.
 */
export const OUTDENT_RETURN_REGEX = /^\s*(return)\b([^[({]|([[({].*[\])}]))*(#.*)?$/;

export function getLanguageConfiguration() {
    return {
        onEnterRules: [
            {
                beforeText: MULTILINE_SEPARATOR_INDENT_REGEX,
                action: { indentAction: IndentAction.Indent }
            },
            {
                beforeText: /^\s*#.*/,
                afterText: /.+$/,
                action: { indentAction: IndentAction.None, appendText: '# ' }
            },
            {
                beforeText: OUTDENT_SINGLE_KEYWORD_REGEX,
                action: { indentAction: IndentAction.Outdent }
            },
            {
                beforeText: OUTDENT_RETURN_REGEX,
                action: { indentAction: IndentAction.Outdent }
            }
        ],
        indentationRules: {
            increaseIndentPattern: INCREASE_INDENT_REGEX,
            decreaseIndentPattern: DECREASE_INDENT_REGEX
        }
    };
}
