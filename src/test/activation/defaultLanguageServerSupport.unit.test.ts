// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as typemoq from 'typemoq';
import { ExtensionContext } from 'vscode';
import {
    DefaultLanguageServerSupport,
    PYLANCE_PROMPT_MEMENTO,
} from '../../client/activation/defaultLanguageServerSupport';
import { IApplicationShell } from '../../client/common/application/types';
import { EXTENSION_VERSION_MEMENTO } from '../../client/common/startPage/startPage';
import { IExtensionContext } from '../../client/common/types';
import { Pylance } from '../../client/common/utils/localize';

suite('Default language server - Show prompt', () => {
    let appShell: typemoq.IMock<IApplicationShell>;
    let context: typemoq.IMock<IExtensionContext>;
    let memento: typemoq.IMock<ExtensionContext['globalState']>;
    let updatedPromptMemento: { key: string; value: unknown } | undefined;

    setup(() => {
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        context = typemoq.Mock.ofType<IExtensionContext>();
        memento = typemoq.Mock.ofType<ExtensionContext['globalState']>();

        context.setup((c) => c.globalState).returns(() => memento.object);
        memento
            .setup((m) => m.update(PYLANCE_PROMPT_MEMENTO, typemoq.It.isAny()))
            .returns((key: string, value: unknown) => {
                updatedPromptMemento = { key, value };

                return Promise.resolve() as Thenable<void>;
            });
    });

    function setupMementos(version?: string, promptShown?: boolean) {
        memento.setup((m) => m.get(EXTENSION_VERSION_MEMENTO)).returns(() => version);
        memento.setup((m) => m.get(PYLANCE_PROMPT_MEMENTO)).returns(() => promptShown);
    }

    teardown(() => {
        context.reset();
        memento.reset();
        updatedPromptMemento = undefined;
    });

    test("Should show prompt if it's an existing installation of the extension and the prompt has not been shown yet", async () => {
        setupMementos('1.0.0', undefined);

        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(Pylance.pylanceDefaultLSMessage()),
                    typemoq.It.isAnyString(),
                ),
            )
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        const defaultLanguageServerActivation = new DefaultLanguageServerSupport(appShell.object, context.object);
        await defaultLanguageServerActivation.activate();

        appShell.verifyAll();
        assert.strictEqual(updatedPromptMemento?.key, PYLANCE_PROMPT_MEMENTO);
        assert.strictEqual(updatedPromptMemento?.value, true);
    });

    test('Should not show prompt if it has been shown before', async () => {
        setupMementos('1.0.0', true);

        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(Pylance.pylanceDefaultLSMessage()),
                    typemoq.It.isAnyString(),
                ),
            )
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.never());

        const defaultLanguageServerActivation = new DefaultLanguageServerSupport(appShell.object, context.object);
        await defaultLanguageServerActivation.activate();

        appShell.verifyAll();
        assert.strictEqual(updatedPromptMemento, undefined);
    });

    test('Should not show prompt if it is a new installation of the extension', async () => {
        setupMementos(undefined, undefined);

        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(Pylance.pylanceDefaultLSMessage()),
                    typemoq.It.isAnyString(),
                ),
            )
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.never());

        const defaultLanguageServerActivation = new DefaultLanguageServerSupport(appShell.object, context.object);
        await defaultLanguageServerActivation.activate();

        appShell.verifyAll();
        assert.strictEqual(updatedPromptMemento, undefined);
    });
});
