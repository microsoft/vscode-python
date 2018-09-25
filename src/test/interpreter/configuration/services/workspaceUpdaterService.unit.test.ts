// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../../client/common/application/types';
import {
    WorkspacePythonPathUpdaterService
} from '../../../../client/interpreter/configuration/services/workspaceUpdaterService';

function normalizeFilename(filename: string): string {
    if (filename === '') {
        return '';
    }
    const parts = filename.split('/');
    if (filename[0] === '/') {
        return path.sep + path.join(...parts);
    } else {
        return path.join(...parts);
    }
}

// tslint:disable-next-line:max-func-body-length
suite('WorkspacePythonPathUpdaterService', () => {
    let workspaceSvc: TypeMoq.IMock<IWorkspaceService>;
    let config: TypeMoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        workspaceSvc = TypeMoq.Mock.ofType<IWorkspaceService>(undefined, TypeMoq.MockBehavior.Strict);
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);

        workspaceSvc.setup(w => w.getConfiguration('python', TypeMoq.It.isAny()))
            .returns(() => config.object);
    });

    function setInfo(pythonPath?: string) {
        const info = {
            key: 'python.pythonPath',
            workspaceValue: pythonPath
            //workspaceFolderValue: pythonPath
        };
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => info);
    }

    test('not set at all', async () => {
        const expected = 'python3';
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => undefined);
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file(__dirname),
            workspaceSvc.object
        );
        await updater.updatePythonPath('python3');

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('not set on workspace', async () => {
        const expected = 'python3';
        setInfo(undefined);
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file(__dirname),
            workspaceSvc.object
        );
        await updater.updatePythonPath('python3');

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('not changed', async () => {
        setInfo('python3');

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file(__dirname),
            workspaceSvc.object
        );
        await updater.updatePythonPath('python3');

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('on $PATH', async () => {
        const expected = 'python3';
        setInfo('python');
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file('some-root'),
            workspaceSvc.object
        );
        await updater.updatePythonPath('python3');

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('under $HOME', async () => {
        const expected = normalizeFilename('~/my-venv/bin/python3');
        setInfo('python');
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file('some-root'),
            workspaceSvc.object
        );
        await updater.updatePythonPath(normalizeFilename('~/my-venv/bin/python3'));

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('relative -- at workspace root', async () => {
        const expected = normalizeFilename('some-root/python3');
        setInfo('python');
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file('some-root'),
            workspaceSvc.object
        );
        await updater.updatePythonPath(normalizeFilename('some-root/python3'));

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('relative -- under workspace root', async () => {
        const expected = normalizeFilename('some-root/my-venv/bin/python3');
        setInfo('python');
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file('some-root'),
            workspaceSvc.object
        );
        await updater.updatePythonPath(normalizeFilename('some-root/my-venv/bin/python3'));

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('relative -- at cwd', async () => {
        const expected = normalizeFilename('./python3');
        setInfo('python');
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file('some-root'),
            workspaceSvc.object
        );
        await updater.updatePythonPath(normalizeFilename('./python3'));

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('relative -- under cwd', async () => {
        const expected = normalizeFilename('./my-venv/bin/python3');
        setInfo('python');
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file('some-root'),
            workspaceSvc.object
        );
        await updater.updatePythonPath(normalizeFilename('./my-venv/bin/python3'));

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('relative -- outside cwd', async () => {
        const expected = normalizeFilename('../my-venv/bin/python3');
        setInfo('python');
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file('some-root'),
            workspaceSvc.object
        );
        await updater.updatePythonPath(normalizeFilename('../my-venv/bin/python3'));

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('absolute - starts with workspace root', async () => {
        const expected = normalizeFilename('/home/user/project/my-venv/bin/python3');
        setInfo('python');
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file(normalizeFilename('/home/user/project')),
            workspaceSvc.object
        );
        await updater.updatePythonPath(normalizeFilename('/home/user/project/my-venv/bin/python3'));

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('absolute - does not start with workspace root', async () => {
        const expected = normalizeFilename('/home/user/my-venv/bin/python3');
        setInfo('python');
        config.setup(c => c.update('pythonPath', expected, false))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file(normalizeFilename('/home/user/project')),
            workspaceSvc.object
        );
        await updater.updatePythonPath(expected);

        workspaceSvc.verifyAll();
        config.verifyAll();
    });
});
