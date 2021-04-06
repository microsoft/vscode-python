// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { CodeLens, commands, env, window } from 'vscode';
import { IExperimentService } from '../../client/common/types';
import { IServiceManager } from '../../client/ioc/types';
import { TensorBoardNbextensionCodeLensProvider } from '../../client/tensorBoard/nbextensionCodeLensProvider';
import { TensorBoardImportCodeLensProvider } from '../../client/tensorBoard/tensorBoardImportCodeLensProvider';
import {
    closeActiveNotebooks,
    closeActiveWindows,
    EXTENSION_ROOT_DIR_FOR_TESTS,
    initialize,
    initializeTest,
} from '../initialize';
import { openFile, waitForCondition } from '../common';
import { openNotebook } from '../smoke/common';

suite('TensorBoard code lens provider', () => {
    suiteSetup(async function () {
        // This test should only run in the insiders build because it relies on
        // being able to open native notebooks
        if (!env.appName.includes('Insider')) {
            this.skip();
        }
    });
    suiteTeardown(closeActiveWindows);
    suite('Nbextension', () => {
        let codeLensProvider: TensorBoardNbextensionCodeLensProvider;
        const sandbox: sinon.SinonSandbox = sinon.createSandbox();
        let experimentService: IExperimentService;
        let serviceManager: IServiceManager;
        setup(async () => {
            ({ serviceManager } = await initialize());
            await initializeTest();
            await closeActiveWindows();
            experimentService = serviceManager.get<IExperimentService>(IExperimentService);
            sandbox.stub(experimentService, 'inExperiment').resolves(true);
            codeLensProvider = serviceManager.get<TensorBoardNbextensionCodeLensProvider>(
                TensorBoardNbextensionCodeLensProvider,
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (codeLensProvider as any).activateInternal();
        });
        teardown(async () => {
            sandbox.restore();
            await closeActiveWindows();
            await closeActiveNotebooks();
        });
        test('Does not provide codelenses for Python file loading tensorboard nbextension', async () => {
            const spy = sandbox.spy(codeLensProvider, 'provideCodeLenses');
            await openFile(
                path.join(
                    EXTENSION_ROOT_DIR_FOR_TESTS,
                    'src',
                    'test',
                    'pythonFiles',
                    'tensorBoard',
                    'tensorboard_launch.py',
                ),
            );
            assert.ok(spy.notCalled, 'Called provideCodeLens for Python file loading tensorboard nbextension');
        });
        test('Provide code lens for Python notebook loading and launching tensorboard nbextension', async () => {
            const filePath = path.join(
                EXTENSION_ROOT_DIR_FOR_TESTS,
                'src',
                'test',
                'pythonFiles',
                'tensorBoard',
                'tensorboard_nbextension.ipynb',
            );
            const notebook = await openNotebook(filePath);
            assert(window.activeTextEditor, 'No active editor');
            const codeLenses = await commands.executeCommand<CodeLens[]>(
                'vscode.executeCodeLensProvider',
                notebook.document.cells[0].document.uri,
            );
            assert.ok(codeLenses?.length && codeLenses.length > 0, 'Code lens provider did not provide codelenses');
        });
    });
    suite('Imports', () => {
        let codeLensProvider: TensorBoardImportCodeLensProvider;
        let experimentService: IExperimentService;
        const sandbox: sinon.SinonSandbox = sinon.createSandbox();
        let serviceManager: IServiceManager;
        let spy: sinon.SinonSpy;
        setup(async () => {
            ({ serviceManager } = await initialize());
            await initializeTest();
            await closeActiveWindows();
            experimentService = serviceManager.get<IExperimentService>(IExperimentService);
            sandbox.stub(experimentService, 'inExperiment').resolves(true);
            codeLensProvider = serviceManager.get<TensorBoardImportCodeLensProvider>(TensorBoardImportCodeLensProvider);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (codeLensProvider as any).activateInternal();
            spy = sandbox.spy(codeLensProvider, 'provideCodeLenses');
        });
        teardown(() => {
            sandbox.restore();
        });
        test('Provides code lens for Python file importing tensorboard', async () => {
            await openFile(
                path.join(
                    EXTENSION_ROOT_DIR_FOR_TESTS,
                    'src',
                    'test',
                    'pythonFiles',
                    'tensorBoard',
                    'tensorboard_imports.py',
                ),
            );
            await waitForCondition(
                async () => spy.called,
                5000,
                'provideCodeLenses not called for Python file loading tensorboard nbextension',
            );
            assert.ok(spy.returnValues.length > 0, 'No return values recorded for provideCodeLens');
            assert.ok(spy.returnValues[0].length === 1, 'provideCodeLenses did not return codelenses');
        });
        test('Provide code lens for Python notebook importing tensorboard', async () => {
            const filePath = path.join(
                EXTENSION_ROOT_DIR_FOR_TESTS,
                'src',
                'test',
                'pythonFiles',
                'tensorBoard',
                'tensorboard_import.ipynb',
            );
            const notebook = await openNotebook(filePath);
            assert(window.activeTextEditor, 'No active editor');
            const codeLenses = await commands.executeCommand<CodeLens[]>(
                'vscode.executeCodeLensProvider',
                notebook.document.cells[0].document.uri,
            );
            assert.ok(codeLenses?.length && codeLenses.length > 0, 'Code lens provider did not provide codelenses');
        });
        test('Does not provide code lens if no matching import', async () => {
            await openFile(
                path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'pythonFiles', 'tensorBoard', 'noMatch.py'),
            );
            assert.ok(spy.notCalled, 'Called provideCodeLens for Python file loading tensorboard nbextension');
        });
    });
});
