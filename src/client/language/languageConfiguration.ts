// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IndentAction } from 'vscode';

export function getLanguageConfiguration() {
    return {
        onEnterRules: [
            // multi-line separator
            {
                beforeText: /^(?!\s+\\)[^#\n]+\\$/,
                action: {
                    indentAction: IndentAction.Indent
                }
            },
            // continue comments
            {
                beforeText: /^\s*#.*/,
                afterText: /.+$/,
                action: {
                    indentAction: IndentAction.None,
                    appendText: '# '
                }
            },
            // outdent on enter
            {
                beforeText: /^\s*(?:break|continue|pass|(?:raise|return)\b.*)\s*(#.*)?$/,
                action: {
                    indentAction: IndentAction.Outdent
                }
            }
        ],
        indentationRules: {
            /**
             * This does not handle all cases. However, it does handle nearly all usage.
             * Here's what it does not cover:
             * - the statement is split over multiple lines (and hence the ":" is on a different line)
             * - the code block is inlined (after the ":")
             * - there are multiple statements on the line (separated by semicolons)
             * Also note that `lambda` is purposefully excluded.
             */
            increaseIndentPattern: /^\s*(?:(?:async|class|def|elif|except|for|if|while|with)\b.*|(else|finally|try))\s*:\s*(#.*)?$/,
            decreaseIndentPattern: /^\s*(?:else|finally|(?:elif|except)\b.*)\s*:\s*(#.*)?$/
        }
    };
}
