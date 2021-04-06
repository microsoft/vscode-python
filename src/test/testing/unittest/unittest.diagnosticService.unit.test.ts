// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { DiagnosticSeverity } from 'vscode';
import * as localize from '../../../client/common/utils/localize';
import { UnitTestDiagnosticService } from '../../../client/testing/common/services/unitTestDiagnosticService';
import { PythonTestMessageSeverity, TestStatus } from '../../../client/testing/common/types';

suite('UnitTestDiagnosticService: unittest', () => {
    let diagnosticService: UnitTestDiagnosticService;

    suiteSetup(() => {
        diagnosticService = new UnitTestDiagnosticService();
    });
    suite('TestStatus: Error', () => {
        let actualPrefix: string;
        let actualSeverity: DiagnosticSeverity;
        let expectedPrefix: string;
        let expectedSeverity: DiagnosticSeverity;
        suiteSetup(() => {
            actualPrefix = diagnosticService.getMessagePrefix(TestStatus.Error);
            actualSeverity = diagnosticService.getSeverity(PythonTestMessageSeverity.Error);
            expectedPrefix = localize.Testing.testErrorDiagnosticMessage();
            expectedSeverity = DiagnosticSeverity.Error;
        });
        test('Message Prefix', () => {
            assert.equal(actualPrefix, expectedPrefix);
        });
        test('Severity', () => {
            assert.equal(actualSeverity, expectedSeverity);
        });
    });
    suite('TestStatus: Fail', () => {
        let actualPrefix: string;
        let actualSeverity: DiagnosticSeverity;
        let expectedPrefix: string;
        let expectedSeverity: DiagnosticSeverity;
        suiteSetup(() => {
            actualPrefix = diagnosticService.getMessagePrefix(TestStatus.Fail);
            actualSeverity = diagnosticService.getSeverity(PythonTestMessageSeverity.Failure);
            expectedPrefix = localize.Testing.testFailDiagnosticMessage();
            expectedSeverity = DiagnosticSeverity.Error;
        });
        test('Message Prefix', () => {
            assert.equal(actualPrefix, expectedPrefix);
        });
        test('Severity', () => {
            assert.equal(actualSeverity, expectedSeverity);
        });
    });
    suite('TestStatus: Skipped', () => {
        let actualPrefix: string;
        let actualSeverity: DiagnosticSeverity;
        let expectedPrefix: string;
        let expectedSeverity: DiagnosticSeverity;
        suiteSetup(() => {
            actualPrefix = diagnosticService.getMessagePrefix(TestStatus.Skipped);
            actualSeverity = diagnosticService.getSeverity(PythonTestMessageSeverity.Skip);
            expectedPrefix = localize.Testing.testSkippedDiagnosticMessage();
            expectedSeverity = DiagnosticSeverity.Information;
        });
        test('Message Prefix', () => {
            assert.equal(actualPrefix, expectedPrefix);
        });
        test('Severity', () => {
            assert.equal(actualSeverity, expectedSeverity);
        });
    });
});
