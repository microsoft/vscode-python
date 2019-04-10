// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import * as localize from '../../../common/utils/localize';
import { DiagnosticMessageType, IUnitTestDiagnosticService, PythonUnitTestMessageSeverity } from '../../types';
import { TestStatus } from '../types';

@injectable()
export class UnitTestDiagnosticService implements IUnitTestDiagnosticService {
    private MessageTypes = new Map<TestStatus, DiagnosticMessageType>();
    private MessageSeverities = new Map<PythonUnitTestMessageSeverity, DiagnosticSeverity | undefined>();
    private MessagePrefixes = new Map<DiagnosticMessageType, string>();

    constructor() {
        this.MessageTypes.set(TestStatus.Error, DiagnosticMessageType.Error);
        this.MessageTypes.set(TestStatus.Fail, DiagnosticMessageType.Fail);
        this.MessageTypes.set(TestStatus.Skipped, DiagnosticMessageType.Skipped);
        this.MessageTypes.set(TestStatus.Pass, DiagnosticMessageType.Pass);
        this.MessageSeverities.set(PythonUnitTestMessageSeverity.Error, DiagnosticSeverity.Error);
        this.MessageSeverities.set(PythonUnitTestMessageSeverity.Failure, DiagnosticSeverity.Error);
        this.MessageSeverities.set(PythonUnitTestMessageSeverity.Skip, DiagnosticSeverity.Information);
        this.MessageSeverities.set(PythonUnitTestMessageSeverity.Pass, undefined);
        this.MessagePrefixes.set(DiagnosticMessageType.Error, localize.Testing.testErrorDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Fail, localize.Testing.testFailDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Skipped, localize.Testing.testSkippedDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Pass, '');
    }
    public getMessagePrefix(status: TestStatus): string | undefined {
        const msgType = this.MessageTypes.get(status);
        return msgType !== undefined ? this.MessagePrefixes.get(msgType!) : undefined;
    }
    public getSeverity(unitTestSeverity: PythonUnitTestMessageSeverity): DiagnosticSeverity | undefined {
        return this.MessageSeverities.get(unitTestSeverity);
    }
}
