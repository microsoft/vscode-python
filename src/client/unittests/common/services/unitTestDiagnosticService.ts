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
    private MessageSeverities = new Map<PythonUnitTestMessageSeverity, DiagnosticSeverity>();
    private MessagePrefixes = new Map<DiagnosticMessageType, string>();

    constructor() {
        this.MessageTypes.set(TestStatus.Error, DiagnosticMessageType.Error);
        this.MessageTypes.set(TestStatus.Fail, DiagnosticMessageType.Fail);
        this.MessageTypes.set(TestStatus.Skipped, DiagnosticMessageType.Skipped);
        this.MessageTypes.set(TestStatus.Pass, DiagnosticMessageType.Pass);
        this.MessageSeverities.set(PythonUnitTestMessageSeverity.Error, DiagnosticSeverity.Error);
        this.MessageSeverities.set(PythonUnitTestMessageSeverity.Failure, DiagnosticSeverity.Error);
        this.MessageSeverities.set(PythonUnitTestMessageSeverity.Skip, DiagnosticSeverity.Information);
        this.MessageSeverities.set(PythonUnitTestMessageSeverity.Pass, null);
        this.MessagePrefixes.set(DiagnosticMessageType.Error, localize.UnitTests.testErrorDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Fail, localize.UnitTests.testFailDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Skipped, localize.UnitTests.testSkippedDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Pass, '');
    }
    public getMessagePrefix(status: TestStatus): string {
        return this.MessagePrefixes.get(this.MessageTypes.get(status));
    }
    public getSeverity(unitTestSeverity: PythonUnitTestMessageSeverity): DiagnosticSeverity {
        return this.MessageSeverities.get(unitTestSeverity);
    }
}
