// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as fakeTimers from '@sinonjs/fake-timers';
import { assert } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { ContextKey } from '../../../client/common/contextKey';
import { CryptoUtils } from '../../../client/common/crypto';
import { EnableTrustedNotebooks } from '../../../client/common/experiments/groups';
import { IDisposable, IExperimentService } from '../../../client/common/types';
import { DataScience } from '../../../client/common/utils/localize';
import { Commands } from '../../../client/datascience/constants';
import { TrustCommandHandler } from '../../../client/datascience/interactive-ipynb/trustCommandHandler';
import { TrustService } from '../../../client/datascience/interactive-ipynb/trustService';
import { INotebookStorageProvider } from '../../../client/datascience/notebookStorage/notebookStorageProvider';
import { VSCodeNotebookModel } from '../../../client/datascience/notebookStorage/vscNotebookModel';
import { INotebookEditorProvider, INotebookModel, ITrustService } from '../../../client/datascience/types';
import { noop } from '../../core';
import { MockMemento } from '../../mocks/mementos';
import { createNotebookDocument, createNotebookModel, disposeAllDisposables } from '../notebook/helper';

// tslint:disable: no-any

suite('DataScience - Trust Command Handler', () => {
    let trustCommandHandler: IExtensionSingleActivationService;
    let trustService: ITrustService;
    let editorProvider: INotebookEditorProvider;
    let storageProvider: INotebookStorageProvider;
    let commandManager: ICommandManager;
    let applicationShell: IApplicationShell;
    let disposables: IDisposable[] = [];
    let clock: fakeTimers.InstalledClock;
    let contextKeySet: sinon.SinonStub<[boolean], Promise<void>>;
    let experiments: IExperimentService;
    let model: INotebookModel;
    let trustNotebookCommandCallback: (uri: Uri) => Promise<void>;
    let testIndex = 0;
    setup(() => {
        trustService = mock<TrustService>();
        editorProvider = mock<INotebookEditorProvider>();
        storageProvider = mock<INotebookStorageProvider>();
        commandManager = mock<ICommandManager>();
        applicationShell = mock<IApplicationShell>();
        const crypto = mock(CryptoUtils);
        testIndex += 1;
        when(crypto.createHash(anything(), 'string')).thenReturn(`${testIndex}`);
        model = createNotebookModel(false, Uri.file('a'), new MockMemento(), instance(crypto));
        createNotebookDocument(model as VSCodeNotebookModel);
        when(storageProvider.getOrCreateModel(anything())).thenResolve(model);
        disposables = [];

        experiments = mock<IExperimentService>();

        when(trustService.trustNotebook(anything(), anything())).thenResolve();
        when(experiments.inExperiment(anything())).thenCall((exp) =>
            Promise.resolve(exp === EnableTrustedNotebooks.experiment)
        );
        when(commandManager.registerCommand(anything(), anything(), anything())).thenCall(() => ({ dispose: noop }));
        when(commandManager.registerCommand(Commands.TrustNotebook, anything(), anything())).thenCall((_, cb) => {
            trustNotebookCommandCallback = cb.bind(trustCommandHandler);
            return { dispose: noop };
        });

        trustCommandHandler = new TrustCommandHandler(
            instance(trustService),
            instance(editorProvider),
            instance(storageProvider),
            instance(commandManager),
            instance(applicationShell),
            disposables,
            instance(experiments)
        );

        clock = fakeTimers.install();

        contextKeySet = sinon.stub(ContextKey.prototype, 'set');
        contextKeySet.resolves();
    });
    teardown(() => {
        sinon.restore();
        disposeAllDisposables(disposables);
        clock.uninstall();
    });

    test('Context not set if not in experiment', async () => {
        when(experiments.inExperiment(anything())).thenResolve(false);

        await trustCommandHandler.activate();
        await clock.runAllAsync();

        assert.equal(contextKeySet.callCount, 0);
    });
    test('Context set if in experiment', async () => {
        when(experiments.inExperiment(anything())).thenCall((exp) =>
            Promise.resolve(exp === EnableTrustedNotebooks.experiment)
        );

        await trustCommandHandler.activate();
        await clock.runAllAsync();

        assert.equal(contextKeySet.callCount, 1);
    });
    test('Executing command will not update trust after dismissing the prompt', async () => {
        when(applicationShell.showErrorMessage(anything(), anything(), anything(), anything())).thenResolve(
            undefined as any
        );

        await trustCommandHandler.activate();
        await clock.runAllAsync();
        await trustNotebookCommandCallback(Uri.file('a'));

        verify(applicationShell.showErrorMessage(anything(), anything(), anything(), anything())).once();
        verify(trustService.trustNotebook(anything(), anything())).never();
        assert.isFalse(model.isTrusted);
    });
    test('Executing command will update trust', async () => {
        when(applicationShell.showErrorMessage(anything(), anything(), anything(), anything())).thenResolve(
            DataScience.trustNotebook() as any
        );

        assert.isFalse(model.isTrusted);
        await trustCommandHandler.activate();
        await clock.runAllAsync();
        await trustNotebookCommandCallback(Uri.file('a'));

        verify(applicationShell.showErrorMessage(anything(), anything(), anything(), anything())).once();
        verify(trustService.trustNotebook(anything(), anything())).once();
        assert.isTrue(model.isTrusted);
    });
});
