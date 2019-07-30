// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { IFileSystem } from '../../../../client/common/platform/types';
import { TestDiscoveredTestParser } from '../../../../client/testing/common/services/discoveredTestParser';
import { Tests } from '../../../../client/testing/common/types';

// tslint:disable:no-any max-func-body-length
suite('Services - Discovered test parser', () => {
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let fileSystem: typemoq.IMock<IFileSystem>;
    let parser: TestDiscoveredTestParser;
    setup(() => {
        workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
        fileSystem = typemoq.Mock.ofType<IFileSystem>();
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
        const discoveredTests = [{
            root: 'path/to/testDataRoot'
        }];
        const buildChildren = sinon.stub(TestDiscoveredTestParser.prototype, 'buildChildren');
        buildChildren.callsFake(() => undefined);
        workspaceService
            .setup(w => w.getWorkspaceFolder(typemoq.It.isAny()))
            .returns(() => undefined)
            .verifiable(typemoq.Times.once());
        fileSystem
            .setup(f => f.arePathsSame('path/to/testDataRoot', 'path/to/workspace'))
            .returns(() => false)
            .verifiable(typemoq.Times.never());
        parser = new TestDiscoveredTestParser(workspaceService.object, fileSystem.object);
        const result = parser.parse(Uri.file('path/to/resource'), discoveredTests as any);
        assert.ok(buildChildren.notCalled);
        assert.deepEqual(expectedTests, result);
        workspaceService.verifyAll();
        fileSystem.verifyAll();
    });

    test('Parse returns empty tests if data root does not matches with workspace root', () => {
        const expectedTests: Tests = {
            rootTestFolders: [],
            summary: { errors: 0, failures: 0, passed: 0, skipped: 0 },
            testFiles: [],
            testFolders: [],
            testFunctions: [],
            testSuites: []
        };
        const discoveredTests = [{
            root: 'path/to/testDataRoot'
        }];
        const workspaceUri = Uri.file('path/to/workspace');
        const workspace = { uri: workspaceUri };
        const buildChildren = sinon.stub(TestDiscoveredTestParser.prototype, 'buildChildren');
        buildChildren.callsFake(() => undefined);
        workspaceService
            .setup(w => w.getWorkspaceFolder(typemoq.It.isAny()))
            .returns(() => workspace as any)
            .verifiable(typemoq.Times.once());
        fileSystem
            .setup(f => f.arePathsSame('path/to/testDataRoot', 'path/to/workspace'))
            .returns(() => false)
            .verifiable(typemoq.Times.atLeastOnce());
        parser = new TestDiscoveredTestParser(workspaceService.object, fileSystem.object);
        const result = parser.parse(workspaceUri, discoveredTests as any);
        assert.ok(buildChildren.notCalled);
        assert.deepEqual(expectedTests, result);
        fileSystem.verifyAll();
    });

    test('Parse returns expected tests if some of data roots matches with workspace root', () => {
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
                    name: workspace.uri.fsPath, folders: [], time: 0,
                    testFiles: [], resource: workspaceUri, nameToRun: 'rootId1'
                }
            ],
            summary: { errors: 0, failures: 0, passed: 0, skipped: 0 },
            testFiles: [],
            testFolders: [
                {
                    name: workspace.uri.fsPath, folders: [], time: 0,
                    testFiles: [], resource: workspaceUri, nameToRun: 'rootId1'
                }
            ],
            testFunctions: [],
            testSuites: []
        };
        const buildChildren = sinon.stub(TestDiscoveredTestParser.prototype, 'buildChildren');
        buildChildren.callsFake(() => undefined);
        workspaceService
            .setup(w => w.getWorkspaceFolder(typemoq.It.isAny()))
            .returns(() => workspace as any)
            .verifiable(typemoq.Times.once());

        // Only test data root 1 matches with path to workspace
        fileSystem
            .setup(f => f.arePathsSame('path/to/testDataRoot1', 'path/to/workspace'))
            .returns(() => true)
            .verifiable(typemoq.Times.atLeastOnce());
        fileSystem
            .setup(f => f.arePathsSame('path/to/testDataRoot2', 'path/to/workspace'))
            .returns(() => false)
            .verifiable(typemoq.Times.atLeastOnce());
        parser = new TestDiscoveredTestParser(workspaceService.object, fileSystem.object);
        const result = parser.parse(workspaceUri, discoveredTests as any);
        assert.ok(buildChildren.calledOnce);
        assert.deepEqual(expectedTests, result);
        fileSystem.verifyAll();
    });
});
