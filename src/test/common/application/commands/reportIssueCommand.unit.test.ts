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
import { MockWorkspaceConfiguration } from '../../../startPage/mockWorkspaceConfig';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import * as Logging from '../../../../client/logging/_global';
import { Commands } from '../../../../client/common/constants';
import { AllCommands } from '../../../../client/common/application/commands';

suite('Report Issue Command', () => {
    let reportIssueCommandHandler: ReportIssueCommandHandler;
    let cmdManager: ICommandManager;
    let workspaceService: IWorkspaceService;
    let interpreterVersionService: IInterpreterVersionService;
    let interpreterService: IInterpreterService;
    let identifyEnvironmentStub: sinon.SinonStub;
    let getPythonOutputContentStub: sinon.SinonStub;

    setup(async () => {
        interpreterVersionService = mock(InterpreterVersionService);
        workspaceService = mock(WorkspaceService);
        cmdManager = mock(CommandManager);
        interpreterService = mock(InterpreterService);

        when(cmdManager.executeCommand('workbench.action.openIssueReporter', anything())).thenResolve();
        when(interpreterVersionService.getVersion(anything(), anything())).thenResolve('3.9.0');
        when(workspaceService.getConfiguration('python')).thenReturn(
            new MockWorkspaceConfiguration({
                languageServer: LanguageServerType.Node,
            }),
        );
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(undefined);
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
        expect(args[1].issueBody).to.be.equal(expectedIssueBody);
    });
});
