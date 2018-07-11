// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Container } from 'inversify';
import * as path from 'path';
import { commands, ConfigurationTarget, languages, Position, TextDocument, window, workspace } from 'vscode';
import { ConfigurationService } from '../../client/common/configuration/service';
import '../../client/common/extensions';
import { IConfigurationService } from '../../client/common/types';
import { activated } from '../../client/extension';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../../client/ioc/types';
import { IsLanguageServerTest } from '../constants';
import { closeActiveWindows } from '../initialize';

const wksPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'exclusions');
const fileOne = path.join(wksPath, 'one.py');

// tslint:disable-next-line:max-func-body-length
suite('Exclude files (Language Server)', () => {
    let textDocument: TextDocument;
    let serviceManager: IServiceManager;
    let serviceContainer: IServiceContainer;
    let configService: IConfigurationService;

    suiteSetup(async function () {
        if (!IsLanguageServerTest()) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });
    setup(async () => {
        const cont = new Container();
        serviceContainer = new ServiceContainer(cont);
        serviceManager = new ServiceManager(cont);

        serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);
        configService = serviceManager.get<IConfigurationService>(IConfigurationService);
     });
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    async function openFile(file: string): Promise<void> {
        textDocument = await workspace.openTextDocument(file);
        await activated;
        await window.showTextDocument(textDocument);
        // Make sure LS completes file loading and analysis.
        // In test mode it awaits for the completion before trying
        // to fetch data for completion, hover.etc.
        await commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, new Position(0, 0));
    }

    async function setSetting(name: string, value: {} | undefined): Promise<void> {
        await configService.updateSettingAsync(name, value, undefined, ConfigurationTarget.Global);
    }

    test('Default exclusions', async () => {
        await openFile(fileOne);
        const diag = languages.getDiagnostics();

        const main = diag.filter(d => d[0].fsPath.indexOf('one.py') >= 0);
        assert.equal(main.length > 0, true);

        const subdir = diag.filter(d => d[0].fsPath.indexOf('three.py') >= 0);
        assert.equal(subdir.length > 0, true);

        const node_modules = diag.filter(d => d[0].fsPath.indexOf('node.py') >= 0);
        assert.equal(node_modules.length, 0);

        const lib = diag.filter(d => d[0].fsPath.indexOf('fileLib.py') >= 0);
        assert.equal(lib.length, 0);

        const sitePackages = diag.filter(d => d[0].fsPath.indexOf('sitePackages.py') >= 0);
        assert.equal(sitePackages.length, 0);
    });
    test('Exclude subfolder', async () => {
        await setSetting('linting.ignorePatterns', ['**/dir1/**']);

        await openFile(fileOne);
        const diag = languages.getDiagnostics();

        const main = diag.filter(d => d[0].fsPath.indexOf('one.py') >= 0);
        assert.equal(main.length > 0, true);

        const subdir1 = diag.filter(d => d[0].fsPath.indexOf('dir1file.py') >= 0);
        assert.equal(subdir1.length, 0);

        const subdir2 = diag.filter(d => d[0].fsPath.indexOf('dir2file.py') >= 0);
        assert.equal(subdir2.length, 0);

        await setSetting('linting.ignorePatterns', undefined);
    });
});
