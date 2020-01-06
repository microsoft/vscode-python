// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { CancellationToken, FormattingOptions, OnTypeFormattingEditProvider, Position, ProviderResult, TextDocument, TextEdit } from 'vscode';
import { OnTypeFormattingDispatcher } from '../../client/typeFormatters/dispatcher';

suite('Formatting - Dispatcher', () => {
    const doc = TypeMoq.Mock.ofType<TextDocument>();
    const pos = TypeMoq.Mock.ofType<Position>();
    const opt = TypeMoq.Mock.ofType<FormattingOptions>();
    const token = TypeMoq.Mock.ofType<CancellationToken>();
    const edits = TypeMoq.Mock.ofType<ProviderResult<TextEdit[]>>();

    test('No providers', async () => {
        const dispatcher = new OnTypeFormattingDispatcher({});

        const triggers = dispatcher.getTriggerCharacters();
        assert.equal(triggers, undefined, 'Trigger was not undefined');

        const result = await dispatcher.provideOnTypeFormattingEdits(doc.object, pos.object, '\n', opt.object, token.object);
        assert.deepStrictEqual(result, [], 'Did not return an empty list of edits');
    });

    test('Single provider', () => {
        const provider = setupProvider(doc.object, pos.object, ':', opt.object, token.object, edits.object);

        const dispatcher = new OnTypeFormattingDispatcher({
            ':': provider.object
        });

        const triggers = dispatcher.getTriggerCharacters();
        assert.deepStrictEqual(triggers, { first: ':', more: [] }, 'Did not return correct triggers');

        const result = dispatcher.provideOnTypeFormattingEdits(doc.object, pos.object, ':', opt.object, token.object);
        assert.equal(result, edits.object, 'Did not return correct edits');

        provider.verifyAll();
    });

    test('Two providers', () => {
        const colonProvider = setupProvider(doc.object, pos.object, ':', opt.object, token.object, edits.object);

        const doc2 = TypeMoq.Mock.ofType<TextDocument>();
        const pos2 = TypeMoq.Mock.ofType<Position>();
        const opt2 = TypeMoq.Mock.ofType<FormattingOptions>();
        const token2 = TypeMoq.Mock.ofType<CancellationToken>();
        const edits2 = TypeMoq.Mock.ofType<ProviderResult<TextEdit[]>>();

        const newlineProvider = setupProvider(doc2.object, pos2.object, '\n', opt2.object, token2.object, edits2.object);

        const dispatcher = new OnTypeFormattingDispatcher({
            ':': colonProvider.object,
            '\n': newlineProvider.object
        });

        const triggers = dispatcher.getTriggerCharacters();
        assert.deepStrictEqual(triggers, { first: '\n', more: [':'] }, 'Did not return correct triggers');

        const result = dispatcher.provideOnTypeFormattingEdits(doc.object, pos.object, ':', opt.object, token.object);
        assert.equal(result, edits.object, 'Did not return correct editsfor colon provider');

        const result2 = dispatcher.provideOnTypeFormattingEdits(doc2.object, pos2.object, '\n', opt2.object, token2.object);
        assert.equal(result2, edits2.object, 'Did not return correct edits for newline provider');

        colonProvider.verifyAll();
        newlineProvider.verifyAll();
    });

    function setupProvider(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        cancellationToken: CancellationToken,
        result: ProviderResult<TextEdit[]>
    ): TypeMoq.IMock<OnTypeFormattingEditProvider> {
        const provider = TypeMoq.Mock.ofType<OnTypeFormattingEditProvider>();
        provider
            .setup(p => p.provideOnTypeFormattingEdits(document, position, ch, options, cancellationToken))
            .returns(() => result)
            .verifiable(TypeMoq.Times.once());
        return provider;
    }
});
