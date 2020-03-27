// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { TestDiscoveredTestParser } from '../../../../client/testing/common/services/discoveredTestParser';
import { Tests } from '../../../../client/testing/common/types';

// tslint:disable:no-any max-func-body-length
suite('Services - Discovered test parser', () => {
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let parser: TestDiscoveredTestParser;
    setup(() => {
        workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
    });

    teardown(() => {
        sinon.restore();
    });

    test('Parse returns empty tests if resource does not belong to workspace', () => {
        // That is, getWorkspaceFolder() returns undefined.
        const expectedTests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, failures: 0, passed: 0, skipped: 0 },
            testFiles: [],
            testFolders: [],
            testFunctions: [],
            testSuites: []
        };
        const discoveredTests = [
            {
                root: 'path/to/testDataRoot'
            }
        ];
        const buildChildren = sinon.stub(TestDiscoveredTestParser.prototype, 'buildChildren');
        buildChildren.callsFake(() => undefined);
        workspaceService
            .setup((w) => w.getWorkspaceFolder(typemoq.It.isAny()))
            .returns(() => undefined)
            .verifiable(typemoq.Times.once());
        parser = new TestDiscoveredTestParser(workspaceService.object);
        const result = parser.parse(Uri.file('path/to/resource'), discoveredTests as any);
        assert.ok(buildChildren.notCalled);
        assert.deepEqual(expectedTests, result);
        workspaceService.verifyAll();
    });

    test('Parse returns expected tests otherwise', () => {
        const discoveredTests = [
            {
                root: 'path/to/testDataRoot1',
                rootid: 'rootId1'
            },
            {
                root: 'path/to/testDataRoot2',
                rootid: 'rootId2'
            }
        ];
        const workspaceUri = Uri.file('path/to/workspace');
        const workspace = { uri: workspaceUri };
        const expectedTests: Tests = {
            rootTestFolders: [
                {
                    name: 'path/to/testDataRoot1',
                    folders: [],
                    time: 0,
                    testFiles: [],
                    resource: workspaceUri,
                    nameToRun: 'rootId1'
                },
                {
                    name: 'path/to/testDataRoot2',
                    folders: [],
                    time: 0,
                    testFiles: [],
                    resource: workspaceUri,
                    nameToRun: 'rootId2'
                }
            ],
            summary: { errors: 0, failures: 0, passed: 0, skipped: 0 },
            testFiles: [],
            testFolders: [
                {
                    name: 'path/to/testDataRoot1',
                    folders: [],
                    time: 0,
                    testFiles: [],
                    resource: workspaceUri,
                    nameToRun: 'rootId1'
                },
                {
                    name: 'path/to/testDataRoot2',
                    folders: [],
                    time: 0,
                    testFiles: [],
                    resource: workspaceUri,
                    nameToRun: 'rootId2'
                }
            ],
            testFunctions: [],
            testSuites: []
        };
        const buildChildren = sinon.stub(TestDiscoveredTestParser.prototype, 'buildChildren');
        buildChildren.callsFake(() => undefined);
        workspaceService
            .setup((w) => w.getWorkspaceFolder(typemoq.It.isAny()))
            .returns(() => workspace as any)
            .verifiable(typemoq.Times.once());
        parser = new TestDiscoveredTestParser(workspaceService.object);
        const result = parser.parse(workspaceUri, discoveredTests as any);
        assert.ok(buildChildren.calledTwice);
        assert.deepEqual(expectedTests, result);
    });
});
