// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, DiagnosticCollection, Uri, window, workspace } from 'vscode';
import { ICommandManager } from '../../client/common/application/types';
import { Product } from '../../client/common/installer/productInstaller';
import { PythonToolExecutionService } from '../../client/common/process/pythonToolService';
import { ExecutionResult, IPythonToolExecutionService, SpawnOptions } from '../../client/common/process/types';
import { ExecutionInfo, IConfigurationService } from '../../client/common/types';
import { ILinterManager } from '../../client/linters/types';
import { deleteFile, IExtensionTestApi, PythonSettingKeys, rootWorkspaceUri } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';

const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
const pythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'linting');

// Mocked out python tool execution (all we need is mocked linter return values).
class MockPythonToolExecService extends PythonToolExecutionService {
    // Mocked samples of linter messages from flake8 and pylint:
    public flake8Msg: string =
        '1,1,W,W391:blank line at end of file\ns:142:13), <anonymous>:1\n1,7,E,E999:SyntaxError: invalid syntax\n';
    public pylintMsg: string =
        "************* Module print\ns:142:13), <anonymous>:1\n1,0,error,syntax-error:Missing parentheses in call to 'print'. Did you mean print(x)? (<unknown>, line 1)\n";

    // Depending on moduleName being exec'd, return the appropriate sample.
    public async exec(
        executionInfo: ExecutionInfo,
        _options: SpawnOptions,
        _resource: Uri
    ): Promise<ExecutionResult<string>> {
        let msg = this.flake8Msg;
        if (executionInfo.moduleName === 'pylint') {
            msg = this.pylintMsg;
        }
        return { stdout: msg };
    }
}

// tslint:disable-next-line:max-func-body-length
suite('Linting - Multiple Linters Enabled Test', () => {
    let api: IExtensionTestApi;
    let configService: IConfigurationService;
    let linterManager: ILinterManager;

    suiteSetup(async () => {
        api = await initialize();
        configService = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        linterManager = api.serviceContainer.get<ILinterManager>(ILinterManager);
    });
    setup(async () => {
        await initializeTest();
        await resetSettings();

        // We only want to return some valid strings from linters, we don't care if they
        // are being returned by actual linters (we aren't testing linters here, only how
        // our code responds to those linters).
        api.serviceManager.rebind<IPythonToolExecutionService>(IPythonToolExecutionService, MockPythonToolExecService);
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        await resetSettings();
        await deleteFile(path.join(workspaceUri.fsPath, '.pylintrc'));
        await deleteFile(path.join(workspaceUri.fsPath, '.pydocstyle'));

        // Restore the execution service as it was...
        api.serviceManager.rebind<IPythonToolExecutionService>(IPythonToolExecutionService, PythonToolExecutionService);
    });

    async function resetSettings() {
        // Don't run these updates in parallel, as they are updating the same file.
        const target = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

        await configService.updateSetting('linting.enabled', true, rootWorkspaceUri, target);
        await configService.updateSetting('linting.lintOnSave', false, rootWorkspaceUri, target);
        await configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);

        linterManager.getAllLinterInfos().forEach(async x => {
            await configService.updateSetting(makeSettingKey(x.product), false, rootWorkspaceUri, target);
        });
    }

    function makeSettingKey(product: Product): PythonSettingKeys {
        return `linting.${linterManager.getLinterInfo(product).enabledSettingName}` as PythonSettingKeys;
    }

    test('Multiple linters', async () => {
        await closeActiveWindows();
        const document = await workspace.openTextDocument(path.join(pythoFilesPath, 'print.py'));
        await window.showTextDocument(document);
        await configService.updateSetting('linting.enabled', true, workspaceUri);
        await configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);
        await configService.updateSetting('linting.pylintEnabled', true, workspaceUri);
        await configService.updateSetting('linting.flake8Enabled', true, workspaceUri);

        const commands = api.serviceContainer.get<ICommandManager>(ICommandManager);

        const collection = (await commands.executeCommand('python.runLinting')) as DiagnosticCollection;
        assert.notEqual(collection, undefined, 'python.runLinting did not return valid diagnostics collection.');

        const messages = collection!.get(document.uri);
        assert.notEqual(messages!.length, 0, 'No diagnostic messages.');
        assert.notEqual(messages!.filter(x => x.source === 'pylint').length, 0, 'No pylint messages.');
        assert.notEqual(messages!.filter(x => x.source === 'flake8').length, 0, 'No flake8 messages.');
    });
});
