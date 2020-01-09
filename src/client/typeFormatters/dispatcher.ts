// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, FormattingOptions, OnTypeFormattingEditProvider, Position, ProviderResult, TextDocument, TextEdit } from 'vscode';

export class OnTypeFormattingDispatcher implements OnTypeFormattingEditProvider {
    private readonly providers: Record<string, OnTypeFormattingEditProvider>;

    constructor(providers: Record<string, OnTypeFormattingEditProvider>) {
        this.providers = providers;
    }

    public provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        cancellationToken: CancellationToken
    ): ProviderResult<TextEdit[]> {
        const provider = this.providers[ch];

        if (provider) {
            return provider.provideOnTypeFormattingEdits(document, position, ch, options, cancellationToken);
        }

        return [];
    }

    public getTriggerCharacters(): { first: string; more: string[] } | undefined {
        const keys = Object.keys(this.providers);
        keys.sort(); // Make output deterministic

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
