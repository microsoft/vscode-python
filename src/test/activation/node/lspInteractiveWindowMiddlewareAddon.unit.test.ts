// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Position, Range, TextDocument, TextLine, Uri } from 'vscode';
import { expect } from 'chai';
import { mock, when } from 'ts-mockito';
import { LanguageClient } from 'vscode-languageclient/node';
import { LspInteractiveWindowMiddlewareAddon } from '../../../client/activation/node/lspInteractiveWindowMiddlewareAddon';
import { JupyterExtensionIntegration } from '../../../client/jupyter/jupyterIntegration';
import { IExtensions, IInstaller } from '../../../client/common/types';
import {
    IComponentAdapter,
    ICondaService,
    IInterpreterDisplay,
    IInterpreterService,
} from '../../../client/interpreter/contracts';
import { IInterpreterSelector } from '../../../client/interpreter/configuration/types';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { ILanguageServerCache } from '../../../client/activation/types';
import { IWorkspaceService } from '../../../client/common/application/types';
import { MockMemento } from '../../mocks/mementos';

suite('Pylance Language Server - Interactive Window LSP Notebooks', () => {
    let languageClient: LanguageClient;
    let jupyterApi: JupyterExtensionIntegration;
    let middleware: LspInteractiveWindowMiddlewareAddon;

    setup(() => {
        languageClient = mock<LanguageClient>();
        jupyterApi = new JupyterExtensionIntegration(
            mock<IExtensions>(),
            mock<IInterpreterService>(),
            mock<IInterpreterSelector>(),
            mock<IInstaller>(),
            mock<IEnvironmentActivationService>(),
            mock<ILanguageServerCache>(),
            new MockMemento(),
            mock<IInterpreterDisplay>(),
            mock<IComponentAdapter>(),
            mock<IWorkspaceService>(),
            mock<ICondaService>(),
        );
        jupyterApi.registerGetNotebookUriForTextDocumentUriFunction(getNotebookUriFunction);
    });
    teardown(() => {
        middleware?.dispose();
    });

    test('Unrelated document open should be forwarded to next handler unchanged', async () => {
        middleware = makeMiddleware();
        let nextCalled = false;

        const mockDoc = mock<TextDocument>();
        const uri = Uri.from({ scheme: 'file', path: 'test.py' });
        when(mockDoc.uri).thenReturn(uri);

        await middleware.didOpen(mockDoc, async (_) => {
            nextCalled = true;
        });

        // eslint-disable-next-line no-unused-expressions
        expect(nextCalled).to.be.true;
    });

    test('Interactive window input box textDocument/didOpen should be swallowed', async () => {
        middleware = makeMiddleware();
        let nextCalled = false;

        const uri = Uri.from({ scheme: 'test-input', path: 'Test' });
        const textLine: TextLine = {
            lineNumber: 0,
            text: '',
            range: new Range(0, 0, 0, 0),
            rangeIncludingLineBreak: new Range(0, 0, 0, 0),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
        };
        const mockDoc = {
            uri,
            fileName: 'foo',
            isUntitled: false,
            languageId: 'python',
            version: 0,
            isDirty: false,
            isClosed: false,
            eol: 0,
            lineCount: 0,
            save: async () => false,
            lineAt: (_: number | Position) => textLine,
            offsetAt: (position: Position) => position.character,
            positionAt: (_: number) => new Position(0, 0),
            getText: (_?: Range | undefined) => '',
            getWordRangeAtPosition: (_: Position, _a?: RegExp) => undefined,
            validateRange: (range: Range) => range,
            validatePosition: (position: Position) => position,
        };

        // when(mockDoc.uri).thenReturn(uri);

        await middleware.didOpen(mockDoc, async (_) => {
            nextCalled = true;
        });

        // eslint-disable-next-line no-unused-expressions
        expect(nextCalled).to.be.false;
    });

    function makeMiddleware(): LspInteractiveWindowMiddlewareAddon {
        return new LspInteractiveWindowMiddlewareAddon(() => languageClient, jupyterApi);
    }

    function getNotebookUriFunction(textDocumentUri: Uri): Uri | undefined {
        if (textDocumentUri.scheme === 'test-input') {
            return textDocumentUri.with({ scheme: 'test-notebook' });
        }

        return undefined;
    }
});
