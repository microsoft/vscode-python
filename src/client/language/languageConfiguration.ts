// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IndentAction, languages } from 'vscode';
import { PYTHON_LANGUAGE } from '../common/constants';

export const MULTILINE_SEPARATOR_INDENT_REGEX = /^(?!\s+\\)[^#\n]+\\$/;
export const INCREASE_INDENT_REGEX = /^\s*(?:async|class|def|elif|else|except|finally|for|if|try|while|with)\b.*:\s*(#.*)?$/;
export const DECREASE_INDENT_REGEX = /^\s*(?:elif|else|except|finally)\b.*:\s*(#.*)?$/;
export const OUTDENT_SINGLE_KEYWORD_REGEX = /^\s*(break|continue|pass|raise)\b.*(#.*)?$/;
export const OUTDENT_RETURN_REGEX = /^\s*(return)\b([^\[\(\{})]|([\[\(\{].*[\]\)\}]))*(#.*)?$/;

export function setLanguageConfiguration() {
    // Enable indentAction
    languages.setLanguageConfiguration(PYTHON_LANGUAGE, {
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
                // Outdent the line following he return statement only if there is no dangling open bracket before the cursor.
                beforeText: OUTDENT_RETURN_REGEX,
                action: { indentAction: IndentAction.Outdent }
            }
        ],
        indentationRules: {
            increaseIndentPattern: INCREASE_INDENT_REGEX,
            decreaseIndentPattern: DECREASE_INDENT_REGEX
        }
    });
}
