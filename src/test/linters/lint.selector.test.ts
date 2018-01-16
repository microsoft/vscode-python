// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { ILintingSettings, PythonSettings } from '../../client/common/configSettings';
import { EnumEx } from '../../client/common/enumUtils';
import { Product } from '../../client/common/types';
import { LinterManager } from '../../client/linters/linterManager';
import { LinterId } from '../../client/linters/types';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const pythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'linting');
const fileToLint = path.join(pythoFilesPath, 'file.py');

// tslint:disable-next-line:max-func-body-length
suite('Linting - Linter Selector', () => {
    let ioc: UnitTestIocContainer;
    const lm = new LinterManager();
    suiteSetup(initialize);
    setup(async () => {
        initializeDI();
        await initializeTest();
        await resetSettings();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
        await resetSettings();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
    }

    async function resetSettings() {
        lm.setCurrentLinter(Product.pylint);
        lm.enableLinting(true);
    }

    test('Select linter', async () => {
        const document = await vscode.workspace.openTextDocument(fileToLint);
        const cancelToken = new vscode.CancellationTokenSource();
    });
});
