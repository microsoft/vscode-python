// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { assert } from 'chai';
import * as sinon from 'sinon';
// import * as typemoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import * as workspaceApis from '../../../../client/common/vscodeApis/workspaceApis';
import { pickWorkspaceFolder } from '../../../../client/pythonEnvironments/creation/common/workspaceSelection';
import * as windowApis from '../../../../client/common/vscodeApis/windowApis';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';

suite('Create environment workspace selection tests', () => {
    let showQuickPickStub: sinon.SinonStub;
    let getWorkspaceFoldersStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;

    setup(() => {
        showQuickPickStub = sinon.stub(windowApis, 'showQuickPick');
        getWorkspaceFoldersStub = sinon.stub(workspaceApis, 'getWorkspaceFolders');
        showErrorMessageStub = sinon.stub(windowApis, 'showErrorMessage');
    });

    teardown(() => {
        sinon.restore();
    });

    test('No workspaces (undefined)', async () => {
        getWorkspaceFoldersStub.returns(undefined);
        assert.isUndefined(await pickWorkspaceFolder());
        assert.isTrue(showErrorMessageStub.calledOnce);
    });

    test('No workspaces (empty array)', async () => {
        getWorkspaceFoldersStub.returns([]);
        assert.isUndefined(await pickWorkspaceFolder());
        assert.isTrue(showErrorMessageStub.calledOnce);
    });

    test('User did not select workspace', async () => {
        const workspaces: WorkspaceFolder[] = [
            {
                uri: Uri.file('some_folder'),
                name: 'some_folder',
                index: 0,
            },
            {
                uri: Uri.file('some_folder2'),
                name: 'some_folder2',
                index: 1,
            },
        ];

        getWorkspaceFoldersStub.returns(workspaces);
        showQuickPickStub.returns(undefined);
        assert.isUndefined(await pickWorkspaceFolder());
    });

    test('single workspace scenario', async () => {
        const workspaces: WorkspaceFolder[] = [
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
                name: 'workspace1',
                index: 0,
            },
        ];

        getWorkspaceFoldersStub.returns(workspaces);
        showQuickPickStub.returns({
            label: workspaces[0].name,
            detail: workspaces[0].uri.fsPath,
            description: undefined,
        });

        const workspace = await pickWorkspaceFolder();
        assert.deepEqual(workspace, workspaces[0]);
        assert(showQuickPickStub.notCalled);
    });

    test('Multi-workspace scenario with single workspace selected', async () => {
        const workspaces: WorkspaceFolder[] = [
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
                name: 'workspace1',
                index: 0,
            },
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace2')),
                name: 'workspace2',
                index: 1,
            },
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace3')),
                name: 'workspace3',
                index: 2,
            },
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace4')),
                name: 'workspace4',
                index: 3,
            },
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace5')),
                name: 'workspace5',
                index: 4,
            },
        ];

        getWorkspaceFoldersStub.returns(workspaces);
        showQuickPickStub.returns({
            label: workspaces[1].name,
            detail: workspaces[1].uri.fsPath,
            description: undefined,
        });

        const workspace = await pickWorkspaceFolder();
        assert.deepEqual(workspace, workspaces[1]);
        assert(showQuickPickStub.calledOnce);
    });

    test('Multi-workspace scenario with multiple workspaces selected', async () => {
        const workspaces: WorkspaceFolder[] = [
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
                name: 'workspace1',
                index: 0,
            },
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace2')),
                name: 'workspace2',
                index: 1,
            },
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace3')),
                name: 'workspace3',
                index: 2,
            },
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace4')),
                name: 'workspace4',
                index: 3,
            },
            {
                uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace5')),
                name: 'workspace5',
                index: 4,
            },
        ];

        getWorkspaceFoldersStub.returns(workspaces);
        showQuickPickStub.returns([
            {
                label: workspaces[1].name,
                detail: workspaces[1].uri.fsPath,
                description: undefined,
            },
            {
                label: workspaces[3].name,
                detail: workspaces[3].uri.fsPath,
                description: undefined,
            },
        ]);

        const workspace = await pickWorkspaceFolder({ allowMultiSelect: true });
        assert.deepEqual(workspace, [workspaces[1], workspaces[3]]);
        assert(showQuickPickStub.calledOnce);
    });
});
