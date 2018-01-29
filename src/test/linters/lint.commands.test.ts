// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
import { QuickPickOptions } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../client/common/application/types';
import { ConfigurationService } from '../../client/common/configuration/service';
import { IConfigurationService, Product } from '../../client/common/types';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceContainer } from '../../client/ioc/types';
import { LinterCommands } from '../../client/linters/linterCommands';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinterManager } from '../../client/linters/types';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Linting - Linter Selector', () => {
    let serviceContainer: IServiceContainer;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let commands: LinterCommands;
    let lm: ILinterManager;

    suiteSetup(initialize);
    setup(async () => {
        await initializeTest();
        initializeServices();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => await closeActiveWindows());

    function initializeServices() {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);

        const commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        serviceManager.addSingletonInstance<ICommandManager>(ICommandManager, commandManager.object);
        serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);

        lm = new LinterManager(serviceContainer);
        serviceManager.addSingletonInstance<ILinterManager>(ILinterManager, lm);

        commands = new LinterCommands(serviceContainer);
    }

    test('Enable linting', async () => {
        await enableDisableLinterAsync(true);
    });

    test('Disable linting', async () => {
        await enableDisableLinterAsync(false);
    });

    test('Single linter active', async () => {
        await selectLinterAsync([Product.pylama]);
    });

    test('Multiple linters active', async () => {
        await selectLinterAsync([Product.flake8, Product.pydocstyle]);
    });

    test('No linters active', async () => {
        await selectLinterAsync([Product.flake8]);
    });

    async function enableDisableLinterAsync(enable: boolean): Promise<void> {
        let suggestions: string[] = [];
        let options: QuickPickOptions;

        await lm.enableLintingAsync(!enable);
        appShell.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((s, o) => {
                suggestions = s as string[];
                options = o as QuickPickOptions;
            })
            .returns((s) => enable
                ? new Promise<string>((resolve, reject) => { return resolve('on'); })
                : new Promise<string>((resolve, reject) => { return resolve('off'); })
            );
        const current = enable ? 'off' : 'on';
        await commands.enableLintingAsync();
        assert.notEqual(suggestions.length, 0, 'showQuickPick was not called');
        assert.notEqual(options!, undefined, 'showQuickPick was not called');

        assert.equal(suggestions.length, 2, 'Wrong number of suggestions');
        assert.equal(suggestions[0], 'on', 'Wrong first suggestions');
        assert.equal(suggestions[1], 'off', 'Wrong second suggestions');

        assert.equal(options!.matchOnDescription, true, 'Quick pick options are incorrect');
        assert.equal(options!.matchOnDetail, true, 'Quick pick options are incorrect');
        assert.equal(options!.placeHolder, `current: ${current}`, 'Quick pick current option is incorrect');
        assert.equal(lm.isLintingEnabled(undefined), enable, 'Linting selector did not change linting on/off flag');
    }

    async function selectLinterAsync(products: Product[]): Promise<void> {
        let suggestions: string[] = [];
        let options: QuickPickOptions;
        let warning: string;

        appShell.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((s, o) => {
                suggestions = s as string[];
                options = o as QuickPickOptions;
            })
            .returns(s => new Promise((resolve, reject) => resolve('pylint')));
        appShell.setup(x => x.showWarningMessage(TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((s, o) => {
                warning = s;
            })
            .returns(s => new Promise((resolve, reject) => resolve('Yes')));

        const linters = lm.getAllLinterInfos();
        await lm.setActiveLintersAsync(products);

        let current: string;
        let activeLinters = lm.getActiveLinters();
        switch (activeLinters.length) {
            case 0:
                current = 'none';
                break;
            case 1:
                current = activeLinters[0].id;
                break;
            default:
                current = 'multiple selected';
                break;
        }

        await commands.setLinterAsync();

        assert.notEqual(suggestions.length, 0, 'showQuickPick was not called');
        assert.notEqual(options!, undefined, 'showQuickPick was not called');

        assert.equal(suggestions.length, linters.length, 'Wrong number of suggestions');
        assert.deepEqual(suggestions, linters.map(x => x.id).sort(), 'Wrong linters order in suggestions');

        assert.equal(options!.matchOnDescription, true, 'Quick pick options are incorrect');
        assert.equal(options!.matchOnDetail, true, 'Quick pick options are incorrect');
        assert.equal(options!.placeHolder, `current: ${current}`, 'Quick pick current option is incorrect');

        activeLinters = lm.getActiveLinters();
        assert.equal(activeLinters.length, 1, 'Linting selector did not change active linter');
        assert.equal(activeLinters[0].product, Product.pylint, 'Linting selector did not change to pylint');

        if (products.length > 1) {
            assert.notEqual(warning!, undefined, 'Warning was not shown when overwriting multiple linters');
        }
    }
});
