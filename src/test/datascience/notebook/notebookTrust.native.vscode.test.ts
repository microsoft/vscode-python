// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-require-imports no-var-requires
import { nbformat } from '@jupyterlab/coreutils';
import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { commands, Uri } from 'vscode';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { PYTHON_LANGUAGE } from '../../../client/common/constants';
import { IConfigurationService, IDataScienceSettings, IDisposable } from '../../../client/common/types';
import { DataScience } from '../../../client/common/utils/localize';
import { Commands } from '../../../client/datascience/constants';
import { deleteKernelMetadataForTests } from '../../../client/datascience/notebook/helpers/helpers';
import { INotebookStorageProvider } from '../../../client/datascience/notebookStorage/notebookStorageProvider';
import { ITrustService } from '../../../client/datascience/types';
import { createEventHandler, IExtensionTestApi, waitForCondition } from '../../common';
import { noop } from '../../core';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import { openNotebook } from '../helpers';
import {
    canRunTests,
    closeNotebooks,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    deleteCell,
    hijackPrompt,
    insertCodeCell,
    saveActiveNotebook,
    waitForKernelToGetAutoSelected
} from './helper';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any no-invalid-this no-function-expression
suite('DataScience - VSCode Notebook - (Trust)', function () {
    this.timeout(15_000);
    const templateIPynbWithOutput = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'withOutputForTrust.ipynb'
    );
    const templateIPynbWithoutOutput = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'withOutputForTrust.ipynb'
    );
    let api: IExtensionTestApi;
    const disposables: IDisposable[] = [];
    let oldTrustSetting: boolean;
    let dsSettings: IDataScienceSettings | undefined;
    let storageProvider: INotebookStorageProvider;
    let vscodeNotebook: IVSCodeNotebook;
    let trustService: ITrustService;
    suiteSetup(async function () {
        this.timeout(35_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        const configService = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        storageProvider = api.serviceContainer.get<INotebookStorageProvider>(INotebookStorageProvider);
        trustService = api.serviceContainer.get<ITrustService>(ITrustService);
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        dsSettings = configService.getSettings().datascience;
        oldTrustSetting = dsSettings.alwaysTrustNotebooks;
        dsSettings.alwaysTrustNotebooks = false;
    });
    suiteTeardown(() => {
        if (dsSettings) {
            dsSettings.alwaysTrustNotebooks = oldTrustSetting === true;
        }
        return closeNotebooksAndCleanUpAfterTests(disposables);
    });

    function assertDocumentTrust(trusted: boolean, hasOutput: boolean) {
        const document = vscodeNotebook.activeNotebookEditor?.document!;
        assert.equal(document.metadata.cellEditable, trusted);
        assert.equal(document.metadata.cellRunnable, trusted);
        assert.equal(document.metadata.editable, trusted);
        assert.equal(document.metadata.runnable, trusted);

        document.cells.forEach((cell) => {
            assert.equal(cell.metadata.editable, trusted);
            if (cell.cellKind === vscodeNotebookEnums.CellKind.Code) {
                assert.equal(cell.metadata.runnable, trusted);
                if (hasOutput) {
                    // In our test all code cells have outputs.
                    if (trusted) {
                        assert.ok(cell.outputs.length, 'No output in trusted cell');
                    } else {
                        assert.lengthOf(cell.outputs, 0, 'Cannot have output in non-trusted notebook');
                    }
                }
            }
        });
        return true;
    }
    [true, false].forEach((withOutput) => {
        suite(`Test notebook ${withOutput ? 'with' : 'without'} output`, () => {
            let ipynbFile: Uri;
            setup(async () => {
                sinon.restore();
                dsSettings!.alwaysTrustNotebooks = true;
                // Don't use same file (due to dirty handling, we might save in dirty.)
                // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
                const templateFileToUse = withOutput ? templateIPynbWithOutput : templateIPynbWithoutOutput;
                ipynbFile = Uri.file(await createTemporaryNotebook(templateFileToUse, disposables));
            });
            teardown(async () => closeNotebooksAndCleanUpAfterTests(disposables));
            test('Opening an untrusted notebook', async () => {
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);
                const model = storageProvider.get(ipynbFile)!;
                assert.isFalse(model.isTrusted);
                assertDocumentTrust(false, withOutput);
            });
            test('Do not prompt to open a trusted notebook', async () => {
                const prompt = await hijackPrompt(
                    'showErrorMessage',
                    { exactMatch: DataScience.launchNotebookTrustPrompt() },
                    { text: DataScience.trustNotebook() },
                    disposables
                );

                // First trust it.
                await trustService.trustNotebook(ipynbFile, fs.readFileSync(ipynbFile.fsPath).toString());

                // Open notebook & Confirm prompt was not displayed & it is trusted.
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);

                // Confirm the notebook is trusted.
                assert.equal(prompt.getDisplayCount(), 0, 'Prompt should have been once before');
                const model = storageProvider.get(ipynbFile)!;
                assert.isTrue(model.isTrusted);
                await waitForCondition(async () => assertDocumentTrust(true, withOutput), 10_000, 'Not trusted');
            });
            test('Verify json before and after trust', async () => {
                const prompt = await hijackPrompt(
                    'showErrorMessage',
                    { exactMatch: DataScience.launchNotebookTrustPrompt() },
                    { text: DataScience.trustNotebook() },
                    disposables
                );
                const contentsOnDisc = fs.readFileSync(ipynbFile.fsPath).toString();

                // First trust it.
                await trustService.trustNotebook(ipynbFile, contentsOnDisc);

                // Open notebook & Confirm prompt was not displayed & it is trusted.
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);
                await waitForKernelToGetAutoSelected();

                // When ipynb content is generated, we don't want the kernel information to be stored in ipynb (only for testing).
                // If kernel metadata is not updated, then JSON should be identical.
                deleteKernelMetadataForTests(vscodeNotebook.activeNotebookEditor?.document!);

                // Confirm the notebook is trusted.
                assert.equal(prompt.getDisplayCount(), 0, 'Prompt should have been once before');
                const model = storageProvider.get(ipynbFile)!;
                assert.isTrue(model.isTrusted);
                await waitForCondition(async () => assertDocumentTrust(true, withOutput), 10_000, 'Not trusted');
                const newContents = model.getContent();
                assert.deepEqual(JSON.parse(contentsOnDisc), JSON.parse(newContents));
                assert.deepEqual(contentsOnDisc.trim(), newContents.trim()); // When comparing ignore white spaces at the ends.
            });
            test('Verify json before and after trust (with changes)', async () => {
                const prompt = await hijackPrompt(
                    'showErrorMessage',
                    { exactMatch: DataScience.launchNotebookTrustPrompt() },
                    { text: DataScience.trustNotebook() },
                    disposables
                );
                const contentsOnDisc = fs.readFileSync(ipynbFile.fsPath).toString();
                const jsonContentsOnDisc = JSON.parse(contentsOnDisc);

                // First trust it.
                await trustService.trustNotebook(ipynbFile, contentsOnDisc);

                // Open notebook & Confirm prompt was not displayed & it is trusted.
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);

                await waitForKernelToGetAutoSelected();

                // When ipynb content is generated, we don't want the kernel information to be stored in ipynb (only for testing).
                // If kernel metadata is not updated, then JSON should be identical.
                deleteKernelMetadataForTests(vscodeNotebook.activeNotebookEditor?.document!);

                // Confirm the notebook is trusted.
                assert.equal(prompt.getDisplayCount(), 0, 'Prompt should have been once before');
                const model = storageProvider.get(ipynbFile)!;
                assert.isTrue(model.isTrusted);
                await waitForCondition(async () => assertDocumentTrust(true, withOutput), 10_000, 'Not trusted');

                // Insert a cell, save & then delete that same cell.
                await insertCodeCell('', { index: 0, language: PYTHON_LANGUAGE });
                await saveActiveNotebook(disposables);
                await deleteCell(0);
                await saveActiveNotebook(disposables);
                const newModelContents = model.getContent();
                const newJsonModelContents = JSON.parse(newModelContents);
                const newContentsOnDisc = fs.readFileSync(ipynbFile.fsPath).toString();
                const newJsonContentsOnDisc = JSON.parse(newContentsOnDisc) as Partial<nbformat.INotebookContent>;

                assert.deepEqual(
                    jsonContentsOnDisc,
                    newJsonModelContents,
                    'Original JSON not same as json generated by model after changes'
                );
                assert.deepEqual(
                    jsonContentsOnDisc,
                    newJsonContentsOnDisc,
                    'Original JSON not same as json stored on disc after saving'
                );

                assert.equal(
                    contentsOnDisc.trim(),
                    newModelContents.trim(),
                    'Original raw content on disc not same as json content generated to be saved on disc by by model after changes'
                ); // When comparing ignore white spaces at the ends.
                assert.equal(
                    contentsOnDisc.trim(),
                    newContentsOnDisc.trim(),
                    'Original raw content on disc not same as json content saved on disc after saving'
                ); // When comparing ignore white spaces at the ends.
            });
            test('Prompted to trust an untrusted notebook and trusted', async () => {
                // Ensure we click `Yes` when prompted to trust the notebook.
                const prompt = await hijackPrompt(
                    'showErrorMessage',
                    { exactMatch: DataScience.launchNotebookTrustPrompt() },
                    { text: DataScience.trustNotebook() },
                    disposables
                );

                const trustSetEvent = createEventHandler(trustService, 'onDidSetNotebookTrust', disposables);

                // Open notebook & Confirm prompt was displayed.
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);
                await waitForCondition(() => prompt.displayed, 10_000, 'Prompt to trust not displayed');
                prompt.clickButton();

                // Verify a document was trusted.
                await trustSetEvent.assertFiredAtLeast(1, 10_000);

                // Confirm the notebook is now trusted.
                const model = storageProvider.get(ipynbFile)!;
                assert.isTrue(model.isTrusted);
                await waitForCondition(async () => assertDocumentTrust(true, withOutput), 10_000, 'Not trusted');

                // Reopening it & we should not get prompted.
                assert.equal(prompt.getDisplayCount(), 1, 'Prompt should have been once before');
                await closeNotebooks();
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);
                assert.equal(prompt.getDisplayCount(), 1, 'Prompt should not have been displayed again');
            });
            test('Prompted to trust an untrusted notebook and not trusted', async () => {
                // Ensure we click `No` when prompted to trust the notebook.
                const prompt = await hijackPrompt(
                    'showErrorMessage',
                    { exactMatch: DataScience.launchNotebookTrustPrompt() },
                    { text: DataScience.doNotTrustNotebook() },
                    disposables
                );

                // Open notebook & Confirm prompt was displayed.
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);
                await waitForCondition(() => prompt.displayed, 10_000, 'Prompt to trust not displayed');
                prompt.clickButton();

                // Confirm the notebook is still untrusted.
                const model = storageProvider.get(ipynbFile)!;
                assert.isFalse(model.isTrusted);
                await waitForCondition(
                    async () => assertDocumentTrust(false, withOutput),
                    10_000,
                    'Should not be trusted'
                );
            });
            test('Trusting notebook using command', async () => {
                // Ensure we click `No` when prompted to trust the notebook.
                const doNotTrustPrompt = await hijackPrompt(
                    'showErrorMessage',
                    { exactMatch: DataScience.launchNotebookTrustPrompt() },
                    { text: DataScience.doNotTrustNotebook() },
                    disposables
                );

                // Open notebook & Confirm prompt was displayed.
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);
                await waitForCondition(() => doNotTrustPrompt.displayed, 10_000, 'Prompt to trust not displayed');
                doNotTrustPrompt.clickButton();

                // Confirm the notebook is still untrusted.
                const model = storageProvider.get(ipynbFile)!;
                assert.isFalse(model.isTrusted);
                await waitForCondition(
                    async () => assertDocumentTrust(false, withOutput),
                    10_000,
                    'Should not be trusted'
                );
                doNotTrustPrompt.dispose(); // Remove previous stub.

                // Ensure we click `Yes` when prompted to trust the notebook.
                const trustSetEvent = createEventHandler(trustService, 'onDidSetNotebookTrust', disposables);
                const trustPrompt = await hijackPrompt(
                    'showErrorMessage',
                    { exactMatch: DataScience.launchNotebookTrustPrompt() },
                    { text: DataScience.trustNotebook() },
                    disposables
                );

                // Select command to trust notebook.
                commands.executeCommand(Commands.TrustNotebook, ipynbFile).then(noop, noop);

                // Verify a document was trusted.
                await waitForCondition(() => trustPrompt.displayed, 10_000, 'Prompt to trust not displayed');
                trustPrompt.clickButton();
                await trustSetEvent.assertFiredAtLeast(1, 10_000);

                // Confirm the notebook is now trusted.
                assert.isTrue(model.isTrusted);
                await waitForCondition(async () => assertDocumentTrust(true, withOutput), 10_000, 'Not trusted');
            });
        });
    });
});
