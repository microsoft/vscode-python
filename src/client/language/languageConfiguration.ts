// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IndentAction, LanguageConfiguration } from 'vscode';
import { verboseRegExp } from '../common/utils/regexp';

// tslint:disable:no-multiline-string

// tslint:disable-next-line:max-func-body-length
export function getLanguageConfiguration(): LanguageConfiguration {
    return {
        onEnterRules: [
            // multi-line separator
            {
                beforeText: verboseRegExp(`
                    ^
                    (?! \\s+ \\\\ )
                    [^#\n]+
                    \\\\
                    $
                `),
                action: {
                    indentAction: IndentAction.Indent,
                },
            },
            // continue comments
            {
                beforeText: /^\s*#.*/,
                afterText: /.+$/,
                action: {
                    indentAction: IndentAction.None,
                    appendText: '# ',
                },
            },
            // indent on enter (block-beginning statements)
            {
                /**
                 * This does not handle all cases. However, it does handle nearly all usage.
                 * Here's what it does not cover:
                 * - the statement is split over multiple lines (and hence the ":" is on a different line)
                 * - the code block is inlined (after the ":")
                 * - there are multiple statements on the line (separated by semicolons)
                 * Also note that `lambda` is purposefully excluded.
                 */
                beforeText: verboseRegExp(`
                    ^
                    \\s*
                    (?:
                        (?:
                            (?:
                                class |
                                def |
                                async \\s+ def |
                                except |
                                for |
                                async \\s+ for |
                                if |
                                elif |
                                while |
                                with |
                                async \\s+ with
                            )
                            \\b .*
                        ) |
                        else |
                        try |
                        finally
                    )
                    \\s*
                    [:]
                    \\s*
                    (?: [#] .* )?
                    $
                `),
                action: {
                    indentAction: IndentAction.Indent,
                },
            },
            // outdent on enter (block-ending statements)
            {
                beforeText: verboseRegExp(`
                    ^
                    (?:
                        (?:
                            \\s*
                            (?:
                                pass |
                                raise \\s+ [^#\\s] [^#]*
                            )
                        ) |
                        (?:
                            \\s+
                            (?:
                                raise |
                                break |
                                continue
                            )
                        )
                    )
                    \\s*
                    (?: [#] .* )?
                    $
                `),
                action: {
                    indentAction: IndentAction.Outdent,
                },
            },
            // Note that we do not currently have an auto-dedent
            // solution for "elif", "else", "except", and "finally".
            // We had one but had to remove it (see issue #6886).
        ],
    };
}
