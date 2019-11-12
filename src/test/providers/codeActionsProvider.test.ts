// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { CancellationToken, CodeActionContext, CodeActionKind, Range, TextDocument } from 'vscode';
import { PythonCodeActionProvider } from '../../client/providers/codeActionsProvider';

suite('CodeAction Provider', () => {
    let codeActionsProvider: PythonCodeActionProvider;
    let document: TypeMoq.IMock<TextDocument>;
    let range: TypeMoq.IMock<Range>;
    let context: TypeMoq.IMock<CodeActionContext>;
    let token: TypeMoq.IMock<CancellationToken>;

    setup(() => {
        codeActionsProvider = new PythonCodeActionProvider();
        document = TypeMoq.Mock.ofType<TextDocument>();
        range = TypeMoq.Mock.ofType<Range>();
        context = TypeMoq.Mock.ofType<CodeActionContext>();
        token = TypeMoq.Mock.ofType<CancellationToken>();
    });

    test('Ensure it always returns a source.organizeImports CodeAction', async () => {
        const codeActions = await codeActionsProvider.provideCodeActions(document.object, range.object, context.object, token.object);

        if (!codeActions) {
            throw Error(`codeActionsProvider.provideCodeActions did not return an array (it returned ${codeActions})`);
        }

        const organizeImportsCodeAction = codeActions.filter(codeAction => codeAction.kind === CodeActionKind.SourceOrganizeImports);
        expect(organizeImportsCodeAction).to.have.length(1);
        expect(organizeImportsCodeAction[0].kind).to.eq(CodeActionKind.SourceOrganizeImports);
    });
});
