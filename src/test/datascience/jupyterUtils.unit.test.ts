// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { WorkspaceService } from '../../client/common/application/workspace';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { expandWorkingDir, modifyTraceback } from '../../client/datascience/jupyter/jupyterUtils';

suite('Data Science JupyterUtils', () => {
    const workspaceService = mock(WorkspaceService);
    // tslint:disable: no-invalid-template-strings
    test('expanding file variables', async function () {
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
        assert.equal(
            expandWorkingDir('${cwd}-${file}', 'bar/bip/foo.baz', inst),
            `${Uri.file('test/bar').fsPath}-${Uri.file('bar/bip/foo.baz').fsPath}`
        );
    });

    test('modifying traceback', () => {
        const trace1 = [
            '"\u001b[1;36m  File \u001b[1;32m"<ipython-input-2-940d61ce6e42>"\u001b[1;36m, line \u001b[1;32m599999\u001b[0m\n\u001b[1;33m    sys.\u001b[0m\n\u001b[1;37m        ^\u001b[0m\n\u001b[1;31mSyntaxError\u001b[0m\u001b[1;31m:\u001b[0m invalid syntax\n"',
        ];
        const after1 = [
            `"\u001b[1;36m  File \u001b[1;32m"footastic.py"\u001b[1;36m, line \u001b[1;32m<a href='file://foo.py?line=600001'>600002</a>\u001b[0m\n\u001b[1;33m    sys.\u001b[0m\n\u001b[1;37m        ^\u001b[0m\n\u001b[1;31mSyntaxError\u001b[0m\u001b[1;31m:\u001b[0m invalid syntax\n"`,
        ];
        const file1 = 'foo.py';
        // Use a join after to make the assert show the results
        assert.equal(
            after1.join('\n'),
            modifyTraceback(file1, 'footastic.py', 2, trace1).join('\n'),
            'Syntax error failure'
        );
        const trace2 = [
            '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[1;31mException\u001b[0m                                 Traceback (most recent call last)',
            "\u001b[1;32md:\\Training\\SnakePython\\manualTestFile.py\u001b[0m in \u001b[0;36m<module>\u001b[1;34m\u001b[0m\n\u001b[0;32m      3\u001b[0m \u001b[1;32mfor\u001b[0m \u001b[0mi\u001b[0m \u001b[1;32min\u001b[0m \u001b[0mtrange\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;36m100\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m:\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0;32m      4\u001b[0m     \u001b[0mtime\u001b[0m\u001b[1;33m.\u001b[0m\u001b[0msleep\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;36m0.01\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[1;32m----> 5\u001b[1;33m     \u001b[1;32mraise\u001b[0m \u001b[0mException\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;34m'spam'\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m",
            '\u001b[1;31mException\u001b[0m: spam',
        ];
        const after2 = [
            '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[1;31mException\u001b[0m                                 Traceback (most recent call last)',
            `\u001b[1;32md:\\Training\\SnakePython\\manualTestFile.py\u001b[0m in \u001b[0;36m<module>\u001b[1;34m\u001b[0m\n\u001b[0;32m      <a href='file://d:\\Training\\SnakePython\\manualTestFile.py?line=23'>24</a>\u001b[0m \u001b[1;32mfor\u001b[0m \u001b[0mi\u001b[0m \u001b[1;32min\u001b[0m \u001b[0mtrange\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;36m100\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m:\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0;32m      <a href='file://d:\\Training\\SnakePython\\manualTestFile.py?line=24'>25</a>\u001b[0m     \u001b[0mtime\u001b[0m\u001b[1;33m.\u001b[0m\u001b[0msleep\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;36m0.01\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[1;32m----> <a href='file://d:\\Training\\SnakePython\\manualTestFile.py?line=25'>26</a>\u001b[1;33m     \u001b[1;32mraise\u001b[0m \u001b[0mException\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;34m'spam'\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m`,
            '\u001b[1;31mException\u001b[0m: spam',
        ];
        const file2 = 'd:\\Training\\SnakePython\\manualTestFile.py';
        assert.equal(after2.join('\n'), modifyTraceback(file2, file2, 20, trace2).join('\n'), 'Exception failure');
        const trace3 = [
            '\u001b[0;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[0;31mModuleNotFoundError\u001b[0m                       Traceback (most recent call last)',
            '\u001b[0;32m~/Test/manualTestFile.py\u001b[0m in \u001b[0;36m<module>\u001b[0;34m\u001b[0m\n\u001b[0;32m----> 4\u001b[0;31m \u001b[0;32mimport\u001b[0m \u001b[0mnumpy\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mnp\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n\u001b[0m\u001b[1;32m      5\u001b[0m \u001b[0;32mimport\u001b[0m \u001b[0mpandas\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mpd\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n\u001b[1;32m      6\u001b[0m \u001b[0;32mimport\u001b[0m \u001b[0mmatplotlib\u001b[0m\u001b[0;34m.\u001b[0m\u001b[0mpyplot\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mplt\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n',
            "\u001b[0;31mModuleNotFoundError\u001b[0m: No module named 'numpy'",
        ];
        const after3 = [
            '\u001b[0;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[0;31mModuleNotFoundError\u001b[0m                       Traceback (most recent call last)',
            "\u001b[0;32m~/Test/manualTestFile.py\u001b[0m in \u001b[0;36m<module>\u001b[0;34m\u001b[0m\n\u001b[0;32m----> <a href='file:///home/rich/Test/manualTestFile.py?line=24'>25</a>\u001b[0;31m \u001b[0;32mimport\u001b[0m \u001b[0mnumpy\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mnp\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n\u001b[0m\u001b[1;32m      <a href='file:///home/rich/Test/manualTestFile.py?line=25'>26</a>\u001b[0m \u001b[0;32mimport\u001b[0m \u001b[0mpandas\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mpd\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n\u001b[1;32m      <a href='file:///home/rich/Test/manualTestFile.py?line=26'>27</a>\u001b[0m \u001b[0;32mimport\u001b[0m \u001b[0mmatplotlib\u001b[0m\u001b[0;34m.\u001b[0m\u001b[0mpyplot\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mplt\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n",
            "\u001b[0;31mModuleNotFoundError\u001b[0m: No module named 'numpy'",
        ];
        const file3 = '/home/rich/Test/manualTestFile.py';
        const display3 = '~/Test/manualTestFile.py';
        assert.equal(
            after3.join('\n'),
            modifyTraceback(file3, display3, 20, trace3).join('\n'),
            'Exception unix failure'
        );
    });
});
