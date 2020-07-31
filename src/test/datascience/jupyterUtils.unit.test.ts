// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { KernelMessage } from '@jupyterlab/services';
import { assert } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { DebugService } from '../../client/common/application/debugService';
import { WorkspaceService } from '../../client/common/application/workspace';
import { ConfigurationService } from '../../client/common/configuration/service';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { DataScienceFileSystem } from '../../client/datascience/dataScienceFileSystem';
import { CellHashProvider } from '../../client/datascience/editor-integration/cellhashprovider';
import { expandWorkingDir } from '../../client/datascience/jupyter/jupyterUtils';
import { createEmptyCell } from '../../datascience-ui/interactive-common/mainState';
import { MockAutoSelectionService } from '../mocks/autoSelector';
import { MockDocument } from './mockDocument';
import { MockDocumentManager } from './mockDocumentManager';
import { MockPythonSettings } from './mockPythonSettings';

suite('DataScience JupyterUtils', () => {
    const workspaceService = mock(WorkspaceService);
    const configService = mock(ConfigurationService);
    const debugService = mock(DebugService);
    const fileSystem = mock(DataScienceFileSystem);
    const docManager = new MockDocumentManager();
    const dummySettings = new MockPythonSettings(undefined, new MockAutoSelectionService());
    when(configService.getSettings(anything())).thenReturn(dummySettings);
    when(fileSystem.getDisplayName(anything())).thenCall((a) => `${a}tastic`);
    when(fileSystem.areLocalPathsSame(anything(), anything())).thenCall((a, b) =>
        a.replace(/\\/g, '/').includes(b.replace(/\\/g, '/'))
    );
    const hashProvider = new CellHashProvider(
        docManager,
        instance(configService),
        instance(debugService),
        instance(fileSystem),
        []
    );

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

    function modifyTraceback(trace: string[]): string[] {
        // Pass onto the hash provider
        const dummyMessage: KernelMessage.IErrorMsg = {
            channel: 'iopub',
            content: {
                ename: 'foo',
                evalue: 'foo',
                traceback: trace
            },
            header: {
                msg_type: 'error',
                msg_id: '1',
                date: '1',
                session: '1',
                username: '1',
                version: '1'
            },
            parent_header: {},
            metadata: {}
        };

        // tslint:disable-next-line: no-any
        return (hashProvider.preHandleIOPub(dummyMessage).content as any).traceback;
    }

    function addCell(code: string, file: string, line: number) {
        const doc = docManager.textDocuments.find((d) => d.fileName === file) as MockDocument;
        if (doc) {
            doc.addContent(code);
        } else {
            // Create a number of emptyish lines above the line
            const emptyLines = Array.from('x'.repeat(line)).join('\n');
            const docCode = `${emptyLines}\n${code}`;
            docManager.addDocument(docCode, file);
        }
        const cell = createEmptyCell(undefined, null);
        cell.file = file;
        cell.line = line;
        cell.data.source = code;
        return hashProvider.preExecute(cell, false);
    }

    test('modifying traceback', async () => {
        await addCell('sys.', 'foo.py', 60);
        const trace1 = [
            '"\u001b[1;36m  File \u001b[1;32mfoo.pytastic\u001b[1;36m, line \u001b[1;32m599999\u001b[0m\n\u001b[1;33m    sys.\u001b[0m\n\u001b[1;37m        ^\u001b[0m\n\u001b[1;31mSyntaxError\u001b[0m\u001b[1;31m:\u001b[0m invalid syntax\n"'
        ];
        const after1 = [
            `"\u001b[1;36m  File \u001b[1;32mfoo.pytastic\u001b[1;36m, line \u001b[1;32m<a href='file://foo.py?line=600058'>600059</a>\u001b[0m\n\u001b[1;33m    sys.\u001b[0m\n\u001b[1;37m        ^\u001b[0m\n\u001b[1;31mSyntaxError\u001b[0m\u001b[1;31m:\u001b[0m invalid syntax\n"`
        ];
        // Use a join after to make the assert show the results
        assert.equal(after1.join('\n'), modifyTraceback(trace1).join('\n'), 'Syntax error failure');

        await addCell(
            `for i in trange(100):
    time.sleep(0.01)
    raise Exception('spam')`,
            'd:\\Training\\SnakePython\\manualTestFile.py',
            1
        );
        const trace2 = [
            '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[1;31mException\u001b[0m                                 Traceback (most recent call last)',
            "\u001b[1;32md:\\Training\\SnakePython\\manualTestFile.pytastic\u001b[0m in \u001b[0;36m<module>\u001b[1;34m\u001b[0m\n\u001b[0;32m      3\u001b[0m \u001b[1;32mfor\u001b[0m \u001b[0mi\u001b[0m \u001b[1;32min\u001b[0m \u001b[0mtrange\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;36m100\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m:\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0;32m      4\u001b[0m     \u001b[0mtime\u001b[0m\u001b[1;33m.\u001b[0m\u001b[0msleep\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;36m0.01\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[1;32m----> 5\u001b[1;33m     \u001b[1;32mraise\u001b[0m \u001b[0mException\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;34m'spam'\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m",
            '\u001b[1;31mException\u001b[0m: spam'
        ];
        const after2 = [
            '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[1;31mException\u001b[0m                                 Traceback (most recent call last)',
            `\u001b[1;32md:\\Training\\SnakePython\\manualTestFile.pytastic\u001b[0m in \u001b[0;36m<module>\u001b[1;34m\u001b[0m\n\u001b[0;32m      <a href='file://d:\\Training\\SnakePython\\manualTestFile.py?line=3'>4</a>\u001b[0m \u001b[1;32mfor\u001b[0m \u001b[0mi\u001b[0m \u001b[1;32min\u001b[0m \u001b[0mtrange\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;36m100\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m:\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0;32m      <a href='file://d:\\Training\\SnakePython\\manualTestFile.py?line=4'>5</a>\u001b[0m     \u001b[0mtime\u001b[0m\u001b[1;33m.\u001b[0m\u001b[0msleep\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;36m0.01\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[1;32m----> <a href='file://d:\\Training\\SnakePython\\manualTestFile.py?line=5'>6</a>\u001b[1;33m     \u001b[1;32mraise\u001b[0m \u001b[0mException\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;34m'spam'\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m`,
            '\u001b[1;31mException\u001b[0m: spam'
        ];
        assert.equal(after2.join('\n'), modifyTraceback(trace2).join('\n'), 'Exception failure');

        when(fileSystem.getDisplayName(anything())).thenReturn('~/Test/manualTestFile.py');
        await addCell(
            `

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt`,
            '/home/rich/Test/manualTestFile.py',
            19
        );
        const trace3 = [
            '\u001b[0;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[0;31mModuleNotFoundError\u001b[0m                       Traceback (most recent call last)',
            '\u001b[0;32m~/Test/manualTestFile.py\u001b[0m in \u001b[0;36m<module>\u001b[0;34m\u001b[0m\n\u001b[0;32m----> 4\u001b[0;31m \u001b[0;32mimport\u001b[0m \u001b[0mnumpy\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mnp\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n\u001b[0m\u001b[1;32m      5\u001b[0m \u001b[0;32mimport\u001b[0m \u001b[0mpandas\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mpd\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n\u001b[1;32m      6\u001b[0m \u001b[0;32mimport\u001b[0m \u001b[0mmatplotlib\u001b[0m\u001b[0;34m.\u001b[0m\u001b[0mpyplot\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mplt\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n',
            "\u001b[0;31mModuleNotFoundError\u001b[0m: No module named 'numpy'"
        ];
        const after3 = [
            '\u001b[0;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[0;31mModuleNotFoundError\u001b[0m                       Traceback (most recent call last)',
            "\u001b[0;32m~/Test/manualTestFile.py\u001b[0m in \u001b[0;36m<module>\u001b[0;34m\u001b[0m\n\u001b[0;32m----> <a href='file:///home/rich/Test/manualTestFile.py?line=24'>25</a>\u001b[0;31m \u001b[0;32mimport\u001b[0m \u001b[0mnumpy\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mnp\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n\u001b[0m\u001b[1;32m      <a href='file:///home/rich/Test/manualTestFile.py?line=25'>26</a>\u001b[0m \u001b[0;32mimport\u001b[0m \u001b[0mpandas\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mpd\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n\u001b[1;32m      <a href='file:///home/rich/Test/manualTestFile.py?line=26'>27</a>\u001b[0m \u001b[0;32mimport\u001b[0m \u001b[0mmatplotlib\u001b[0m\u001b[0;34m.\u001b[0m\u001b[0mpyplot\u001b[0m \u001b[0;32mas\u001b[0m \u001b[0mplt\u001b[0m\u001b[0;34m\u001b[0m\u001b[0;34m\u001b[0m\u001b[0m\n",
            "\u001b[0;31mModuleNotFoundError\u001b[0m: No module named 'numpy'"
        ];
        assert.equal(after3.join('\n'), modifyTraceback(trace3).join('\n'), 'Exception unix failure');
        when(fileSystem.getDisplayName(anything())).thenReturn('d:\\Training\\SnakePython\\foo.py');

        await addCell(
            `# %%

def cause_error():
    print('start')
    print('error')
    print('now')

    print( 1 / 0)
`,
            'd:\\Training\\SnakePython\\foo.py',
            133
        );
        await addCell(
            `# %%
print('some more')

cause_error()`,
            'd:\\Training\\SnakePython\\foo.py',
            142
        );
        const trace4 = [
            '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[1;31mZeroDivisionError\u001b[0m                         Traceback (most recent call last)',
            "\u001b[1;32md:\\Training\\SnakePython\\foo.py\u001b[0m in \u001b[0;36m<module>\u001b[1;34m\u001b[0m\n\u001b[0;32m      1\u001b[0m \u001b[0mprint\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;34m'some more'\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0;32m      2\u001b[0m \u001b[1;33m\u001b[0m\u001b[0m\n\u001b[1;32m----> 3\u001b[1;33m \u001b[0mcause_error\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m",
            "\u001b[1;32md:\\Training\\SnakePython\\foo.py\u001b[0m in \u001b[0;36mcause_error\u001b[1;34m()\u001b[0m\n\u001b[0;32m      4\u001b[0m     \u001b[0mprint\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;34m'now'\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0;32m      5\u001b[0m \u001b[1;33m\u001b[0m\u001b[0m\n\u001b[1;32m----> 6\u001b[1;33m     \u001b[0mprint\u001b[0m\u001b[1;33m(\u001b[0m \u001b[1;36m1\u001b[0m \u001b[1;33m/\u001b[0m \u001b[1;36m0\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m"
        ];
        const after4 = [
            '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
            '\u001b[1;31mZeroDivisionError\u001b[0m                         Traceback (most recent call last)',
            "\u001b[1;32md:\\Training\\SnakePython\\foo.py\u001b[0m in \u001b[0;36m<module>\u001b[1;34m\u001b[0m\n\u001b[0;32m      <a href='file://d:\\Training\\SnakePython\\foo.py?line=143'>144</a>\u001b[0m \u001b[0mprint\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;34m'some more'\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0;32m      <a href='file://d:\\Training\\SnakePython\\foo.py?line=144'>145</a>\u001b[0m \u001b[1;33m\u001b[0m\u001b[0m\n\u001b[1;32m----> <a href='file://d:\\Training\\SnakePython\\foo.py?line=145'>146</a>\u001b[1;33m \u001b[0mcause_error\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m",
            "\u001b[1;32md:\\Training\\SnakePython\\foo.py\u001b[0m in \u001b[0;36mcause_error\u001b[1;34m()\u001b[0m\n\u001b[0;32m      <a href='file://d:\\Training\\SnakePython\\foo.py?line=138'>139</a>\u001b[0m     \u001b[0mprint\u001b[0m\u001b[1;33m(\u001b[0m\u001b[1;34m'now'\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0;32m      <a href='file://d:\\Training\\SnakePython\\foo.py?line=139'>140</a>\u001b[0m \u001b[1;33m\u001b[0m\u001b[0m\n\u001b[1;32m----> <a href='file://d:\\Training\\SnakePython\\foo.py?line=140'>141</a>\u001b[1;33m     \u001b[0mprint\u001b[0m\u001b[1;33m(\u001b[0m \u001b[1;36m1\u001b[0m \u001b[1;33m/\u001b[0m \u001b[1;36m0\u001b[0m\u001b[1;33m)\u001b[0m\u001b[1;33m\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m"
        ];
        assert.equal(after4.join('\n'), modifyTraceback(trace4).join('\n'), 'Multiple levels');
    });
});
