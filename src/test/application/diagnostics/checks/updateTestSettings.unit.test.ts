// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { anyString, anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { ApplicationEnvironment } from '../../../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment, IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { IPersistentState } from '../../../../client/common/types';
import { UpdateTestSettingService } from '../../../../client/testing/common/updateTestSettings';

// tslint:disable:max-func-body-length no-invalid-this no-any
suite('Application Diagnostics - Check Test Settings', () => {
    let diagnosticService: UpdateTestSettingService;
    let fs: IFileSystem;
    let appEnv: IApplicationEnvironment;
    let storage: IPersistentState<string[]>;
    let workspace: IWorkspaceService;
    const sandbox = sinon.createSandbox();
    setup(() => {
        fs = mock(FileSystem);
        appEnv = mock(ApplicationEnvironment);
        storage = mock(PersistentState);
        workspace = mock(WorkspaceService);
        const stateFactory = mock(PersistentStateFactory);

        when(stateFactory.createGlobalPersistentState('python.unitTest.Settings', anything())).thenReturn(
            instance(storage)
        );

        diagnosticService = new UpdateTestSettingService(instance(fs), instance(appEnv), instance(workspace));
    });
    teardown(() => {
        sandbox.restore();
    });
    [Uri.file(__filename), undefined].forEach((resource) => {
        const resourceTitle = resource ? '(with a resource)' : '(without a resource)';

        test(`activate method invokes UpdateTestSettings ${resourceTitle}`, async () => {
            const updateTestSettings = sandbox.stub(UpdateTestSettingService.prototype, 'updateTestSettings');
            updateTestSettings.resolves();
            diagnosticService = new UpdateTestSettingService(instance(fs), instance(appEnv), instance(workspace));

            await diagnosticService.activate(resource);

            assert.ok(updateTestSettings.calledOnce);
        });

        test(`activate method invokes UpdateTestSettings and ignores errors raised by UpdateTestSettings ${resourceTitle}`, async () => {
            const updateTestSettings = sandbox.stub(UpdateTestSettingService.prototype, 'updateTestSettings');
            updateTestSettings.rejects(new Error('Kaboom'));
            diagnosticService = new UpdateTestSettingService(instance(fs), instance(appEnv), instance(workspace));

            await diagnosticService.activate(resource);

            assert.ok(updateTestSettings.calledOnce);
        });

        test(`When there are no workspaces, then return just the user settings file ${resourceTitle}`, async () => {
            when(workspace.getWorkspaceFolder(anything())).thenReturn();
            when(appEnv.userSettingsFile).thenReturn('user.json');

            const files = diagnosticService.getSettingsFiles(resource);

            assert.deepEqual(files, ['user.json']);
            verify(workspace.getWorkspaceFolder(resource)).once();
        });
        test(`When there are no workspaces & no user file, then return an empty array ${resourceTitle}`, async () => {
            when(workspace.getWorkspaceFolder(anything())).thenReturn();
            when(appEnv.userSettingsFile).thenReturn();

            const files = diagnosticService.getSettingsFiles(resource);

            assert.deepEqual(files, []);
            verify(workspace.getWorkspaceFolder(resource)).once();
        });
        test(`When there is a workspace folder, then return the user settings file & workspace file ${resourceTitle}`, async function () {
            if (!resource) {
                return this.skip();
            }
            when(workspace.getWorkspaceFolder(resource)).thenReturn({ name: '1', uri: Uri.file('folder1'), index: 0 });
            when(appEnv.userSettingsFile).thenReturn('user.json');

            const files = diagnosticService.getSettingsFiles(resource);

            assert.deepEqual(files, ['user.json', path.join(Uri.file('folder1').fsPath, '.vscode', 'settings.json')]);
            verify(workspace.getWorkspaceFolder(resource)).once();
        });
        test(`When there is a workspace folder & no user file, then workspace file ${resourceTitle}`, async function () {
            if (!resource) {
                return this.skip();
            }
            when(workspace.getWorkspaceFolder(resource)).thenReturn({ name: '1', uri: Uri.file('folder1'), index: 0 });
            when(appEnv.userSettingsFile).thenReturn();

            const files = diagnosticService.getSettingsFiles(resource);

            assert.deepEqual(files, [path.join(Uri.file('folder1').fsPath, '.vscode', 'settings.json')]);
            verify(workspace.getWorkspaceFolder(resource)).once();
        });
        test(`Return an empty array if there are no files ${resourceTitle}`, async () => {
            const getSettingsFiles = sandbox.stub(UpdateTestSettingService.prototype, 'getSettingsFiles');
            getSettingsFiles.returns([]);
            diagnosticService = new UpdateTestSettingService(instance(fs), instance(appEnv), instance(workspace));

            const files = await diagnosticService.getFilesToBeFixed(resource);

            expect(files).to.deep.equal([]);
        });
        test(`Filter files based on whether they need to be fixed ${resourceTitle}`, async () => {
            const getSettingsFiles = sandbox.stub(UpdateTestSettingService.prototype, 'getSettingsFiles');
            const filterFiles = sandbox.stub(UpdateTestSettingService.prototype, 'doesFileNeedToBeFixed');
            filterFiles.callsFake((file) => Promise.resolve(file === 'file_a' || file === 'file_c'));
            getSettingsFiles.returns(['file_a', 'file_b', 'file_c', 'file_d']);

            diagnosticService = new UpdateTestSettingService(instance(fs), instance(appEnv), instance(workspace));

            const files = await diagnosticService.getFilesToBeFixed(resource);

            expect(files).to.deep.equal(['file_a', 'file_c']);
        });
    });
    [
        {
            testTitle: 'Should fix file if contents contains python.unitTest.',
            expectedValue: true,
            contents: '{"python.pythonPath":"1234", "python.unitTest.unitTestArgs":[]}'
        },
        {
            testTitle: 'Should fix file if contents contains python.pyTest.',
            expectedValue: true,
            contents: '{"python.pythonPath":"1234", "python.pyTestArgs":[]}'
        },
        {
            testTitle: 'Should fix file if contents contains python.pyTest. & python.unitTest.',
            expectedValue: true,
            contents: '{"python.pythonPath":"1234", "python.testing.pyTestArgs":[], "python.unitTest.unitTestArgs":[]}'
        },
        {
            testTitle: 'Should not fix file if contents does not contain python.unitTest. and python.pyTest',
            expectedValue: false,
            contents: '{"python.pythonPath":"1234", "python.unittest.unitTestArgs":[]}'
        }
    ].forEach((item) => {
        test(item.testTitle, async () => {
            when(fs.readFile(__filename)).thenResolve(item.contents);

            const needsToBeFixed = await diagnosticService.doesFileNeedToBeFixed(__filename);

            expect(needsToBeFixed).to.equal(item.expectedValue);
            verify(fs.readFile(__filename)).once();
        });
    });
    test("File should not be fixed if there's an error in reading the file", async () => {
        when(fs.readFile(__filename)).thenReject(new Error('Kaboom'));

        const needsToBeFixed = await diagnosticService.doesFileNeedToBeFixed(__filename);

        assert.ok(!needsToBeFixed);
        verify(fs.readFile(__filename)).once();
    });

    [
        {
            testTitle: 'Should replace python.unitTest.',
            contents: '{"python.pythonPath":"1234", "python.unitTest.unitTestArgs":[]}',
            expectedContents: '{"python.pythonPath":"1234", "python.testing.unitTestArgs":[]}'
        },
        {
            testTitle: 'Should replace python.unitTest.pyTest.',
            contents:
                '{"python.pythonPath":"1234", "python.unitTest.pyTestArgs":[], "python.unitTest.pyTestArgs":[], "python.unitTest.pyTestPath":[]}',
            expectedContents:
                '{"python.pythonPath":"1234", "python.testing.pytestArgs":[], "python.testing.pytestArgs":[], "python.testing.pytestPath":[]}'
        },
        {
            testTitle: 'Should replace python.testing.pyTest.',
            contents:
                '{"python.pythonPath":"1234", "python.testing.pyTestArgs":[], "python.testing.pyTestArgs":[], "python.testing.pyTestPath":[]}',
            expectedContents:
                '{"python.pythonPath":"1234", "python.testing.pytestArgs":[], "python.testing.pytestArgs":[], "python.testing.pytestPath":[]}'
        },
        {
            testTitle: 'Should not make any changes to the file',
            contents:
                '{"python.pythonPath":"1234", "python.unittest.unitTestArgs":[], "python.unitTest.pytestArgs":[], "python.testing.pytestArgs":[], "python.testing.pytestPath":[]}',
            expectedContents:
                '{"python.pythonPath":"1234", "python.unittest.unitTestArgs":[], "python.testing.pytestArgs":[], "python.testing.pytestArgs":[], "python.testing.pytestPath":[]}'
        }
    ].forEach((item) => {
        test(item.testTitle, async () => {
            when(fs.readFile(__filename)).thenResolve(item.contents);
            when(fs.writeFile(__filename, anything())).thenResolve();

            const actualContent = await diagnosticService.fixSettingInFile(__filename, false);

            verify(fs.readFile(__filename)).once();
            verify(fs.writeFile(__filename, anyString())).once();
            expect(actualContent).to.be.equal(item.expectedContents);
        });
    });

    [
        {
            testTitle: 'No jediEnabled setting.',
            contents: '{}',
            expectedContent: '{ "python.languageServer": "Jedi" }'
        },
        {
            testTitle: 'jediEnabled: true, no languageServer setting',
            contents: '{ "python.jediEnabled": true }',
            expectedContent: '{"python.languageServer": "Jedi"}'
        },
        {
            testTitle: 'jediEnabled: true, languageServer setting present',
            contents: '{ "python.jediEnabled": true }',
            expectedContent: '{"python.languageServer": "Jedi"}'
        },
        {
            testTitle: 'jediEnabled: false, no languageServer setting',
            contents: '{ "python.jediEnabled": false }',
            expectedContent: '{"python.languageServer": "Microsoft"}'
        },
        {
            testTitle: 'jediEnabled: false, languageServer is Microsoft',
            contents: '{ "python.jediEnabled": false, "python.languageServer": "Microsoft" }',
            expectedContent: '{"python.languageServer": "Microsoft"}'
        },
        {
            testTitle: 'jediEnabled: false, languageServer is None',
            contents: '{ "python.jediEnabled": false, "python.languageServer": "None" }',
            expectedContent: '{"python.languageServer": "None"}'
        },
        {
            testTitle: 'jediEnabled: false, languageServer is Jedi',
            contents: '{ "python.jediEnabled": false, "python.languageServer": "Jedi" }',
            expectedContent: '{"python.languageServer": "Jedi"}'
        }
    ].forEach((item) => {
        test(item.testTitle, async () => {
            when(fs.readFile(__filename)).thenResolve(item.contents);

            const actualContent = await diagnosticService.fixSettingInFile(__filename);

            expect(nows(actualContent)).to.equal(nows(item.expectedContent));
            verify(fs.readFile(__filename)).once();
        });
    });

    function nows(s: string): string {
        return s.replace(/\s*/g, '');
    }
});
