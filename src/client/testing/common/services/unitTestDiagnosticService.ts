// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import * as localize from '../../../common/utils/localize';
import { DiagnosticMessageType, ITestDiagnosticService, PythonTestMessageSeverity } from '../../types';
import { TestStatus } from '../types';

@injectable()
export class UnitTestDiagnosticService implements ITestDiagnosticService {
    private MessageTypes = new Map<TestStatus, DiagnosticMessageType>();
    private MessageSeverities = new Map<PythonTestMessageSeverity, DiagnosticSeverity | undefined>();
    private MessagePrefixes = new Map<DiagnosticMessageType, string>();

    constructor() {
        this.MessageTypes.set(TestStatus.Error, DiagnosticMessageType.Error);
        this.MessageTypes.set(TestStatus.Fail, DiagnosticMessageType.Fail);
        this.MessageTypes.set(TestStatus.Skipped, DiagnosticMessageType.Skipped);
        this.MessageTypes.set(TestStatus.Pass, DiagnosticMessageType.Pass);
        this.MessageSeverities.set(PythonTestMessageSeverity.Error, DiagnosticSeverity.Error);
        this.MessageSeverities.set(PythonTestMessageSeverity.Failure, DiagnosticSeverity.Error);
        this.MessageSeverities.set(PythonTestMessageSeverity.Skip, DiagnosticSeverity.Information);
        this.MessageSeverities.set(PythonTestMessageSeverity.Pass, undefined);
        this.MessagePrefixes.set(DiagnosticMessageType.Error, localize.Testing.testErrorDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Fail, localize.Testing.testFailDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Skipped, localize.Testing.testSkippedDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Pass, '');
    }
    public getMessagePrefix(status: TestStatus): string | undefined {
        const msgType = this.MessageTypes.get(status);
        return msgType !== undefined ? this.MessagePrefixes.get(msgType) : undefined;
    }
    public getSeverity(unitTestSeverity: PythonTestMessageSeverity): DiagnosticSeverity | undefined {
        return this.MessageSeverities.get(unitTestSeverity);
    }
}
