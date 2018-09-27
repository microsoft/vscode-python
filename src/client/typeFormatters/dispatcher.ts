// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, FormattingOptions, OnTypeFormattingEditProvider, Position, ProviderResult, TextDocument, TextEdit } from 'vscode';
import { BlockFormatProviders } from './blockFormatProvider';
import { OnEnterFormatter } from './onEnterFormatter';

export class OnTypeFormattingDispatcher implements OnTypeFormattingEditProvider {
    private readonly onEnterFormatter = new OnEnterFormatter();
    private readonly blockFormatProviders = new BlockFormatProviders();

    private readonly formatters: { [key: string]: OnTypeFormattingEditProvider } = {
        '\n': this.onEnterFormatter,
        ':': this.blockFormatProviders
    };

    public provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, cancellationToken: CancellationToken): ProviderResult<TextEdit[]> {
        const formatter = this.formatters[ch];

        if (formatter) {
            return formatter.provideOnTypeFormattingEdits(document, position, ch, options, cancellationToken);
        }

        return [];
    }

    public getTriggerCharacters(): { first: string; more: string[] } | undefined {
        const keys = Object.keys(this.formatters);

        const first = keys.shift();

        if (first) {
            return {
                first: first,
                more: keys
            };
        }

        return undefined;
    }
}
