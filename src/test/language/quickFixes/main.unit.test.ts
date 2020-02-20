// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: match-default-export-name
import { assert, expect } from 'chai';
import rewiremock from 'rewiremock';
import { CodeActionProvider, CodeActionProviderMetadata, DocumentSelector } from 'vscode';
import { QuickFixLaunchJson } from '../../../client/language/quickFixes/fixLaunchJson';
import { QuickFixService } from '../../../client/language/quickFixes/main';

suite('Quick fix service', async () => {
    setup(() => {
        rewiremock.disable();
    });
    test('Code actions are registered correctly', async () => {
        let selector: DocumentSelector;
        let provider: CodeActionProvider;
        let metadata: CodeActionProviderMetadata;
        const vscodeMock = {
            languages: {
                registerCodeActionsProvider: (
                    _selector: DocumentSelector,
                    _provider: CodeActionProvider,
                    _metadata: CodeActionProviderMetadata
                ) => {
                    selector = _selector;
                    provider = _provider;
                    metadata = _metadata;
                }
            },
            CodeActionKind: {
                QuickFix: 'CodeAction'
            }
        };
        rewiremock.enable();
        rewiremock('vscode').with(vscodeMock);
        const quickFixService = new QuickFixService();

        await quickFixService.activate();

        // Ensure QuickFixLaunchJson is registered with correct arguments
        assert.deepEqual(selector!, {
            scheme: 'file',
            language: 'jsonc',
            pattern: '**/launch.json'
        });
        assert.deepEqual(metadata!, {
            // tslint:disable-next-line:no-any
            providedCodeActionKinds: ['CodeAction' as any]
        });
        expect(provider!).instanceOf(QuickFixLaunchJson);
    });
});
