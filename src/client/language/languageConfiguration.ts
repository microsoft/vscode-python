// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IndentAction, languages } from 'vscode';
import { PYTHON_LANGUAGE } from '../common/constants';

export const MULTILINE_SEPARATOR_INDENT_REGEX = /^(?!\s+\\)[^#\n]+\\$/;

export function setLanguageConfiguration() {
    // Enable indentAction
    languages.setLanguageConfiguration(PYTHON_LANGUAGE, {
        onEnterRules: [
            {
                beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async)\b.*:\s*/,
                action: { indentAction: IndentAction.Indent }
            },
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
                beforeText: /^\s+(continue|break|return)\b.*/,
                afterText: /\s+$/,
                action: { indentAction: IndentAction.Outdent }
            }
        ]
    });
}
