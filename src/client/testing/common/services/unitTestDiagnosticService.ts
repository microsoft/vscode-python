// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import * as localize from '../../../common/utils/localize';
import {
    DiagnosticMessageType,
    ITestDiagnosticService,
    NonPassingTestMessageType,
    NonPassingTestSeverity,
    NonPassingTestStatus,
    PythonTestMessageSeverity,
    TestStatus,
} from '../types';

@injectable()
export class UnitTestDiagnosticService implements ITestDiagnosticService {
    private MessageTypes = new Map<NonPassingTestStatus, NonPassingTestMessageType>();

    private MessageSeverities = new Map<NonPassingTestSeverity, DiagnosticSeverity | undefined>();

    private MessagePrefixes = new Map<NonPassingTestMessageType, string>();

    constructor() {
        this.MessageTypes.set(TestStatus.Error, DiagnosticMessageType.Error);
        this.MessageTypes.set(TestStatus.Fail, DiagnosticMessageType.Fail);
        this.MessageTypes.set(TestStatus.Skipped, DiagnosticMessageType.Skipped);
        this.MessageSeverities.set(PythonTestMessageSeverity.Error, DiagnosticSeverity.Error);
        this.MessageSeverities.set(PythonTestMessageSeverity.Failure, DiagnosticSeverity.Error);
        this.MessageSeverities.set(PythonTestMessageSeverity.Skip, DiagnosticSeverity.Information);
        this.MessagePrefixes.set(DiagnosticMessageType.Error, localize.Testing.testErrorDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Fail, localize.Testing.testFailDiagnosticMessage());
        this.MessagePrefixes.set(DiagnosticMessageType.Skipped, localize.Testing.testSkippedDiagnosticMessage());
    }

    public getMessagePrefix(status: NonPassingTestStatus): string | undefined {
        const msgType = this.MessageTypes.get(status);
        // If `msgType` is `undefined` then it means we've added a new
        // failing test status but forgot to support it here (or it means
        // elsewhere we asserted a bogus value, like `undefined`).
        return msgType !== undefined ? this.MessagePrefixes.get(msgType) : undefined;
    }

    public getSeverity(unitTestSeverity: NonPassingTestSeverity): DiagnosticSeverity | undefined {
        return this.MessageSeverities.get(unitTestSeverity);
    }
}
