// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Container } from 'inversify';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { IApplicationShell } from '../../client/common/application/types';
import { ILintingSettings, IPythonSettings, IPythonSettingsProvider } from '../../client/common/configSettings';
import { Commands } from '../../client/common/constants';
import { EnumEx } from '../../client/common/enumUtils';
import { Product } from '../../client/common/types';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceContainer } from '../../client/ioc/types';
import { LinterManager } from '../../client/linters/linterManager';
import { LinterSelector } from '../../client/linters/linterSelector';
import { ILinterManager, LinterId } from '../../client/linters/types';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const pythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'linting');
const fileToLint = path.join(pythoFilesPath, 'file.py');

// tslint:disable-next-line:max-func-body-length
suite('Linting - Linter Selector', () => {
    let serviceContainer: IServiceContainer;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let settingsProvider: TypeMoq.IMock<IPythonSettingsProvider>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let selector: LinterSelector;
    let lm: ILinterManager;

    suiteSetup(initialize);
    setup(async () => {
        initializeServices();
        await initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
    });

    function initializeServices() {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        settingsProvider = TypeMoq.Mock.ofType<IPythonSettingsProvider>();
        settingsProvider.setup(p => p.getInstance(TypeMoq.It.isAny())).returns(() => settings.object);

        serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);
        serviceManager.addSingletonInstance<IPythonSettingsProvider>(IPythonSettingsProvider, settingsProvider.object);

        selector = new LinterSelector(serviceContainer);
        lm = new LinterManager(serviceContainer);
    }

    test('Select linter', async () => {
        const document = await vscode.workspace.openTextDocument(fileToLint);
        const cancelToken = new vscode.CancellationTokenSource();

        selector.enableLinting();
    });
});
