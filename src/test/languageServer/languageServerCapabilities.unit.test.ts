// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { ILanguageServerProxy } from '../../client/activation/types';
import { LanguageServerCapabilities } from '../../client/languageServer/languageServerCapabilities';

suite('Language server - capabilities', () => {
    test('get() should not return undefined', async () => {
        const capabilities = new LanguageServerCapabilities();

        const result = await capabilities.get();

        assert.notDeepStrictEqual(result, undefined);
    });

    test('The connection property should return an object if there is a language client', () => {
        const serverProxy = ({
            languageClient: {
                sendNotification: () => {
                    /* nothing */
                },
                sendRequest: () => {
                    /* nothing */
                },
                sendProgress: () => {
                    /* nothing */
                },
                onRequest: () => {
                    /* nothing */
                },
                onNotification: () => {
                    /* nothing */
                },
                onProgress: () => {
                    /* nothing */
                },
            },
        } as unknown) as ILanguageServerProxy;

        const capabilities = new LanguageServerCapabilities();
        capabilities.serverProxy = serverProxy;

        const result = capabilities.connection;

        assert.notDeepStrictEqual(result, undefined);
        assert.strictEqual(typeof result, 'object');
    });

    test('The connection property should return undefined if there is no language client', () => {
        const serverProxy = ({} as unknown) as ILanguageServerProxy;

        const capabilities = new LanguageServerCapabilities();
        capabilities.serverProxy = serverProxy;

        const result = capabilities.connection;

        assert.deepStrictEqual(result, undefined);
    });

    test('capabilities() should return an object if there is an initialized language client', () => {
        const serverProxy = ({
            languageClient: {
                initializeResult: {
                    capabilities: {},
                },
            },
        } as unknown) as ILanguageServerProxy;

        const capabilities = new LanguageServerCapabilities();
        capabilities.serverProxy = serverProxy;

        const result = capabilities.capabilities;

        assert.notDeepStrictEqual(result, undefined);
        assert.strictEqual(typeof result, 'object');
    });

    test('capabilities() should return undefined if there is no language client', () => {
        const serverProxy = ({} as unknown) as ILanguageServerProxy;

        const capabilities = new LanguageServerCapabilities();
        capabilities.serverProxy = serverProxy;

        const result = capabilities.capabilities;

        assert.deepStrictEqual(result, undefined);
    });

    test('capabilities() should return undefined if the language client is not initialized', () => {
        const serverProxy = ({
            languageClient: {
                initializeResult: undefined,
            },
        } as unknown) as ILanguageServerProxy;

        const capabilities = new LanguageServerCapabilities();
        capabilities.serverProxy = serverProxy;

        const result = capabilities.capabilities;

        assert.deepStrictEqual(result, undefined);
    });
});
