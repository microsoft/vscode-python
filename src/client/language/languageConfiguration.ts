// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IndentAction } from 'vscode';
import { verboseRegExp } from '../common/utils/regexp';

// tslint:disable:no-multiline-string

// tslint:disable-next-line:max-func-body-length
export function getLanguageConfiguration() {
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
                                continue |
                                return
                            )
                        )
                    )
                    \\s*
                    (?: [#] .* )?
                    $
                `),
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
            increaseIndentPattern: verboseRegExp(`
                ^
                \\s*
                (?:
                    (?:
                        (?:
                            async \\s+ def |
                            class |
                            def |
                            except |
                            for |
                            if |
                            elif |
                            while |
                            with
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
            decreaseIndentPattern: verboseRegExp(`
                ^
                \\s*
                (?:
                    (?:
                        (?:
                            elif |
                            except
                        )
                        \\b .*
                    ) |
                    else |
                    finally
                )
                \\s*
                [:]
                \\s*
                (?: [#] .* )?
                $
            `)
        }
    };
}
