// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as sinon from 'sinon';
import * as fs from 'fs-extra';
import * as path from 'path';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { expect } from 'chai';
import { LanguageServerType } from '../../../../client/activation/types';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { ReportIssueCommandHandler } from '../../../../client/common/application/commands/reportIssueCommand';
import { ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { IInterpreterService, IInterpreterVersionService } from '../../../../client/interpreter/contracts';
import { InterpreterVersionService } from '../../../../client/interpreter/interpreterVersion';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import * as EnvIdentifier from '../../../../client/pythonEnvironments/common/environmentIdentifier';
import { MockWorkspaceConfiguration } from '../../../mocks/mockWorkspaceConfig';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import * as Logging from '../../../../client/logging/_global';
import { Commands } from '../../../../client/common/constants';
import { AllCommands } from '../../../../client/common/application/commands';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { IConfigurationService } from '../../../../client/common/types';

suite('Report Issue Command', () => {
    let reportIssueCommandHandler: ReportIssueCommandHandler;
    let cmdManager: ICommandManager;
    let workspaceService: IWorkspaceService;
    let interpreterVersionService: IInterpreterVersionService;
    let interpreterService: IInterpreterService;
    let configurationService: IConfigurationService;
    let identifyEnvironmentStub: sinon.SinonStub;
    let getPythonOutputContentStub: sinon.SinonStub;

    setup(async () => {
        interpreterVersionService = mock(InterpreterVersionService);
        workspaceService = mock(WorkspaceService);
        cmdManager = mock(CommandManager);
        interpreterService = mock(InterpreterService);
        configurationService = mock(ConfigurationService);

        when(cmdManager.executeCommand('workbench.action.openIssueReporter', anything())).thenResolve();
        when(interpreterVersionService.getVersion(anything(), anything())).thenResolve('3.9.0');
        when(workspaceService.getConfiguration('python')).thenReturn(
            new MockWorkspaceConfiguration({
                languageServer: LanguageServerType.Node,
            }),
        );
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(undefined);
        when(configurationService.getSettings()).thenReturn({
            experiments: {
                enabled: true,
                optInto: [],
                optOutFrom: [],
            },
            insidersChannel: 'off',
            initialize: true,
            venvPath: 'path',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        identifyEnvironmentStub = sinon.stub(EnvIdentifier, 'identifyEnvironment');
        identifyEnvironmentStub.resolves(PythonEnvKind.Venv);

        cmdManager = mock(CommandManager);

        getPythonOutputContentStub = sinon.stub(Logging, 'getPythonOutputChannelContent');
        getPythonOutputContentStub.resolves('Python Output');
        reportIssueCommandHandler = new ReportIssueCommandHandler(
            instance(cmdManager),
            instance(workspaceService),
            instance(interpreterService),
            instance(interpreterVersionService),
            instance(configurationService),
        );
        await reportIssueCommandHandler.activate();
    });

    teardown(() => {
        identifyEnvironmentStub.restore();
        getPythonOutputContentStub.restore();
    });

    test('Test if issue body is filled', async () => {
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
});
