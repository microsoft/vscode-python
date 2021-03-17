// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { ReportIssueCommandHandler } from '../../../../client/common/application/commands/reportIssueCommand';
import { ICommandManager } from '../../../../client/common/application/types';

suite('Report Issue Command', () => {
    let reportIssueCommandHandler: ReportIssueCommandHandler;
    let cmdManager: ICommandManager;
    setup(async () => {
        cmdManager = mock(CommandManager);
        reportIssueCommandHandler = new ReportIssueCommandHandler(instance(cmdManager));
        when(cmdManager.executeCommand(anything())).thenResolve();
        await reportIssueCommandHandler.activate();
    });

    test('Confirm command handler is added', async () => {
        verify(cmdManager.registerCommand('python.reportIssue', anything(), anything())).once();
    });
});
