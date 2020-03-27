// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import { anything, capture, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { CancellationTokenSource, FormattingOptions, TextDocument, Uri } from 'vscode';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import { IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { PythonSettings } from '../../client/common/configSettings';
import { ConfigurationService } from '../../client/common/configuration/service';
import { STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { PythonToolExecutionService } from '../../client/common/process/pythonToolService';
import { IPythonToolExecutionService } from '../../client/common/process/types';
import {
    ExecutionInfo,
    IConfigurationService,
    IDisposableRegistry,
    IFormattingSettings,
    IOutputChannel,
    IPythonSettings,
} from '../../client/common/types';
import { AutoPep8Formatter } from '../../client/formatters/autoPep8Formatter';
import { BaseFormatter } from '../../client/formatters/baseFormatter';
import { BlackFormatter } from '../../client/formatters/blackFormatter';
import { FormatterHelper } from '../../client/formatters/helper';
import { IFormatterHelper } from '../../client/formatters/types';
import { YapfFormatter } from '../../client/formatters/yapfFormatter';
import { ServiceContainer } from '../../client/ioc/container';
import { IServiceContainer } from '../../client/ioc/types';
import { noop } from '../core';
import { MockOutputChannel } from '../mockClasses';

// tslint:disable-next-line: max-func-body-length
suite('Formatting - Test Arguments', () => {
    let container: IServiceContainer;
    let outputChannel: IOutputChannel;
    let workspace: IWorkspaceService;
    let settings: IPythonSettings;
    const workspaceUri = Uri.file(__dirname);
    let document: typemoq.IMock<TextDocument>;
    const docUri = Uri.file(__filename);
    let pythonToolExecutionService: IPythonToolExecutionService;
    const options: FormattingOptions = { insertSpaces: false, tabSize: 1 };
    const formattingSettingsWithPath: IFormattingSettings = {
        autopep8Args: ['1', '2'],
        autopep8Path: path.join('a', 'exe'),
        blackArgs: ['1', '2'],
        blackPath: path.join('a', 'exe'),
        provider: '',
        yapfArgs: ['1', '2'],
        yapfPath: path.join('a', 'exe'),
    };

    const formattingSettingsWithModuleName: IFormattingSettings = {
        autopep8Args: ['1', '2'],
        autopep8Path: 'module_name',
        blackArgs: ['1', '2'],
        blackPath: 'module_name',
        provider: '',
        yapfArgs: ['1', '2'],
        yapfPath: 'module_name',
    };

    setup(() => {
        container = mock(ServiceContainer);
        outputChannel = mock(MockOutputChannel);
        workspace = mock(WorkspaceService);
        settings = mock(PythonSettings);
        document = typemoq.Mock.ofType<TextDocument>();
        document.setup((doc) => doc.getText(typemoq.It.isAny())).returns(() => '');
        document.setup((doc) => doc.isDirty).returns(() => false);
        document.setup((doc) => doc.fileName).returns(() => docUri.fsPath);
        document.setup((doc) => doc.uri).returns(() => docUri);
        pythonToolExecutionService = mock(PythonToolExecutionService);

        const configService = mock(ConfigurationService);
        const formatterHelper = new FormatterHelper(instance(container));

        const appShell = mock(ApplicationShell);
        when(appShell.setStatusBarMessage(anything(), anything())).thenReturn({ dispose: noop });

        when(configService.getSettings(anything())).thenReturn(instance(settings));
        when(workspace.getWorkspaceFolder(anything())).thenReturn({ name: '', index: 0, uri: workspaceUri });
        when(container.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL)).thenReturn(
            instance(outputChannel)
        );
        when(container.get<IApplicationShell>(IApplicationShell)).thenReturn(instance(appShell));
        when(container.get<IFormatterHelper>(IFormatterHelper)).thenReturn(formatterHelper);
        when(container.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspace));
        when(container.get<IConfigurationService>(IConfigurationService)).thenReturn(instance(configService));
        when(container.get<IPythonToolExecutionService>(IPythonToolExecutionService)).thenReturn(
            instance(pythonToolExecutionService)
        );
        when(container.get<IDisposableRegistry>(IDisposableRegistry)).thenReturn([]);
    });

    async function setupFormatter(
        formatter: BaseFormatter,
        formattingSettings: IFormattingSettings
    ): Promise<ExecutionInfo> {
        const token = new CancellationTokenSource().token;
        when(settings.formatting).thenReturn(formattingSettings);
        when(pythonToolExecutionService.exec(anything(), anything(), anything())).thenResolve({ stdout: '' });

        await formatter.formatDocument(document.object, options, token);

        const args = capture(pythonToolExecutionService.exec).first();
        return args[0];
    }
    test('Ensure blackPath and args used to launch the formatter', async () => {
        const formatter = new BlackFormatter(instance(container));

        const execInfo = await setupFormatter(formatter, formattingSettingsWithPath);

        assert.equal(execInfo.execPath, formattingSettingsWithPath.blackPath);
        assert.equal(execInfo.moduleName, undefined);
        assert.deepEqual(
            execInfo.args,
            formattingSettingsWithPath.blackArgs.concat(['--diff', '--quiet', docUri.fsPath])
        );
    });
    test('Ensure black modulename and args used to launch the formatter', async () => {
        const formatter = new BlackFormatter(instance(container));

        const execInfo = await setupFormatter(formatter, formattingSettingsWithModuleName);

        assert.equal(execInfo.execPath, formattingSettingsWithModuleName.blackPath);
        assert.equal(execInfo.moduleName, formattingSettingsWithModuleName.blackPath);
        assert.deepEqual(
            execInfo.args,
            formattingSettingsWithPath.blackArgs.concat(['--diff', '--quiet', docUri.fsPath])
        );
    });
    test('Ensure autopep8path and args used to launch the formatter', async () => {
        const formatter = new AutoPep8Formatter(instance(container));

        const execInfo = await setupFormatter(formatter, formattingSettingsWithPath);

        assert.equal(execInfo.execPath, formattingSettingsWithPath.autopep8Path);
        assert.equal(execInfo.moduleName, undefined);
        assert.deepEqual(execInfo.args, formattingSettingsWithPath.autopep8Args.concat(['--diff', docUri.fsPath]));
    });
    test('Ensure autpep8 modulename and args used to launch the formatter', async () => {
        const formatter = new AutoPep8Formatter(instance(container));

        const execInfo = await setupFormatter(formatter, formattingSettingsWithModuleName);

        assert.equal(execInfo.execPath, formattingSettingsWithModuleName.autopep8Path);
        assert.equal(execInfo.moduleName, formattingSettingsWithModuleName.autopep8Path);
        assert.deepEqual(execInfo.args, formattingSettingsWithPath.autopep8Args.concat(['--diff', docUri.fsPath]));
    });
    test('Ensure yapfpath and args used to launch the formatter', async () => {
        const formatter = new YapfFormatter(instance(container));

        const execInfo = await setupFormatter(formatter, formattingSettingsWithPath);

        assert.equal(execInfo.execPath, formattingSettingsWithPath.yapfPath);
        assert.equal(execInfo.moduleName, undefined);
        assert.deepEqual(execInfo.args, formattingSettingsWithPath.yapfArgs.concat(['--diff', docUri.fsPath]));
    });
    test('Ensure yapf modulename and args used to launch the formatter', async () => {
        const formatter = new YapfFormatter(instance(container));

        const execInfo = await setupFormatter(formatter, formattingSettingsWithModuleName);

        assert.equal(execInfo.execPath, formattingSettingsWithModuleName.yapfPath);
        assert.equal(execInfo.moduleName, formattingSettingsWithModuleName.yapfPath);
        assert.deepEqual(execInfo.args, formattingSettingsWithPath.yapfArgs.concat(['--diff', docUri.fsPath]));
    });
});
