/* eslint-disable global-require */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as sinon from 'sinon';
import * as fs from 'fs-extra';
import * as path from 'path';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { expect } from 'chai';
import { WorkspaceFolder } from 'vscode-languageserver-protocol';
import * as Telemetry from '../../../../client/telemetry';
import { LanguageServerType } from '../../../../client/activation/types';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { ReportIssueCommandHandler } from '../../../../client/common/application/commands/reportIssueCommand';
import {
    IApplicationEnvironment,
    ICommandManager,
    IWorkspaceService,
} from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { IInterpreterService } from '../../../../client/interpreter/contracts';
import { MockWorkspaceConfiguration } from '../../../mocks/mockWorkspaceConfig';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import { Commands, EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { AllCommands } from '../../../../client/common/application/commands';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { IConfigurationService } from '../../../../client/common/types';
import { EventName } from '../../../../client/telemetry/constants';
import { EnvironmentType, PythonEnvironment } from '../../../../client/pythonEnvironments/info';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';

suite('Report Issue Command', () => {
    let reportIssueCommandHandler: ReportIssueCommandHandler;
    let cmdManager: ICommandManager;
    let workspaceService: IWorkspaceService;
    let interpreterService: IInterpreterService;
    let configurationService: IConfigurationService;
    let appEnvironment: IApplicationEnvironment;

    setup(async () => {
        workspaceService = mock(WorkspaceService);
        cmdManager = mock(CommandManager);
        interpreterService = mock(InterpreterService);
        configurationService = mock(ConfigurationService);
        appEnvironment = mock<IApplicationEnvironment>();

        when(cmdManager.executeCommand('workbench.action.openIssueReporter', anything())).thenResolve();
        when(workspaceService.getConfiguration('python')).thenReturn(
            new MockWorkspaceConfiguration({
                languageServer: LanguageServerType.Node,
            }),
        );
        const interpreter = ({
            envType: EnvironmentType.Venv,
            version: { raw: '3.9.0' },
        } as unknown) as PythonEnvironment;
        when(interpreterService.getActiveInterpreter()).thenResolve(interpreter);
        when(configurationService.getSettings()).thenReturn({
            experiments: {
                enabled: false,
                optInto: [],
                optOutFrom: [],
            },
            initialize: true,
            venvPath: 'path',
            pipenvPath: 'pipenv',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        cmdManager = mock(CommandManager);

        reportIssueCommandHandler = new ReportIssueCommandHandler(
            instance(cmdManager),
            instance(workspaceService),
            instance(interpreterService),
            instance(configurationService),
            instance(appEnvironment),
        );
        await reportIssueCommandHandler.activate();
    });

    teardown(() => {
        sinon.restore();
    });

    test('Test if issue body is filled correctly when including all the settings', async () => {
        await reportIssueCommandHandler.openReportIssue();

        const templatePath = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'common',
            'application',
            'commands',
            'issueTemplateVenv1.md',
        );
        const expectedIssueBody = fs.readFileSync(templatePath, 'utf8');

        const args: [string, { extensionId: string; issueBody: string }] = capture<
            AllCommands,
            { extensionId: string; issueBody: string }
        >(cmdManager.executeCommand).last();

        verify(cmdManager.registerCommand(Commands.ReportIssue, anything(), anything())).once();
        verify(cmdManager.executeCommand('workbench.action.openIssueReporter', anything())).once();
        expect(args[0]).to.be.equal('workbench.action.openIssueReporter');
        const actual = args[1].issueBody;
        expect(actual).to.be.equal(expectedIssueBody);
    });

    test('Test if issue body is filled when only including settings which are explicitly set', async () => {
        // eslint-disable-next-line import/no-dynamic-require
        when(appEnvironment.packageJson).thenReturn(require(path.join(EXTENSION_ROOT_DIR, 'package.json')));
        when(workspaceService.workspaceFolders).thenReturn([
            instance(mock(WorkspaceFolder)),
            instance(mock(WorkspaceFolder)),
        ]); // Multiroot scenario
        reportIssueCommandHandler = new ReportIssueCommandHandler(
            instance(cmdManager),
            instance(workspaceService),
            instance(interpreterService),
            instance(configurationService),
            instance(appEnvironment),
        );
        await reportIssueCommandHandler.activate();
        await reportIssueCommandHandler.openReportIssue();

        const templatePath = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'common',
            'application',
            'commands',
            'issueTemplateVenv2.md',
        );
        const expectedIssueBody = fs.readFileSync(templatePath, 'utf8');

        const args: [string, { extensionId: string; issueBody: string }] = capture<
            AllCommands,
            { extensionId: string; issueBody: string }
        >(cmdManager.executeCommand).last();

        verify(cmdManager.executeCommand('workbench.action.openIssueReporter', anything())).once();
        expect(args[0]).to.be.equal('workbench.action.openIssueReporter');
        const actual = args[1].issueBody;
        expect(actual).to.be.equal(expectedIssueBody);
    });
    test('Should send telemetry event when run Report Issue Command', async () => {
        const sendTelemetryStub = sinon.stub(Telemetry, 'sendTelemetryEvent');
        await reportIssueCommandHandler.openReportIssue();

        sinon.assert.calledWith(sendTelemetryStub, EventName.USE_REPORT_ISSUE_COMMAND);
        sinon.restore();
    });
});
