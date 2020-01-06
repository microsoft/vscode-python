// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { WorkspaceService } from '../../client/common/application/workspace';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { expandWorkingDir } from '../../client/datascience/jupyter/jupyterUtils';

suite('Data Science JupyterUtils', () => {
    const workspaceService = mock(WorkspaceService);
    // tslint:disable: no-invalid-template-strings
    test('expanding file variables', async function() {
        // tslint:disable-next-line: no-invalid-this
        this.timeout(10000);
        const uri = Uri.file('test/bar');
        const folder = { index: 0, name: '', uri };
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([folder]);
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(folder);
        const inst = instance(workspaceService);
        const relativeFilePath = IS_WINDOWS ? '..\\xyz\\bip\\foo.baz' : '../xyz/bip/foo.baz';
        const relativeFileDir = IS_WINDOWS ? '..\\xyz\\bip' : '../xyz/bip';

        assert.equal(expandWorkingDir(undefined, 'bar/foo.baz', inst), 'bar');
        assert.equal(expandWorkingDir(undefined, 'bar/bip/foo.baz', inst), 'bar/bip');
        assert.equal(expandWorkingDir('${file}', 'bar/bip/foo.baz', inst), Uri.file('bar/bip/foo.baz').fsPath);
        assert.equal(expandWorkingDir('${fileDirname}', 'bar/bip/foo.baz', inst), Uri.file('bar/bip').fsPath);
        assert.equal(expandWorkingDir('${relativeFile}', 'test/xyz/bip/foo.baz', inst), relativeFilePath);
        assert.equal(expandWorkingDir('${relativeFileDirname}', 'test/xyz/bip/foo.baz', inst), relativeFileDir);
        assert.equal(expandWorkingDir('${cwd}', 'test/xyz/bip/foo.baz', inst), Uri.file('test/bar').fsPath);
        assert.equal(expandWorkingDir('${workspaceFolder}', 'test/xyz/bip/foo.baz', inst), Uri.file('test/bar').fsPath);
        assert.equal(expandWorkingDir('${cwd}-${file}', 'bar/bip/foo.baz', inst), `${Uri.file('test/bar').fsPath}-${Uri.file('bar/bip/foo.baz').fsPath}`);
    });
});
