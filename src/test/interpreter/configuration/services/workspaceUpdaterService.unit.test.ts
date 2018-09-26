// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../../client/common/application/types';
import {
    WorkspaceFolderPythonPathUpdaterService,
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
        };
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => info);
    }

    function setExpected(expected: string) {
        config.setup(c => c.update('pythonPath', expected, ConfigurationTarget.Workspace))
            .returns(() => Promise.resolve());
    }

    test('not set at all', async () => {
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => undefined);
        setExpected('python3');

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file(__dirname),
            workspaceSvc.object
        );
        await updater.updatePythonPath('python3');

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('not set on workspace', async () => {
        setInfo(undefined);
        setExpected('python3');

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

    const workspaceRoot = normalizeFilename('/home/user/project');
    const tests: [string, string, string][] = [
        // (test name, new pythonPath, expected)
        // If "expected" is an empty string then the new pythonPath is used.
        ['on $PATH', 'python3', ''],
        ['under $HOME', '~/my-venv/bin/python3', ''],

        ['relative -- at workspace root', 'python3', ''],
        ['relative -- under workspace root', 'my-venv/bin/python3', ''],
        ['relative -- at workspace root directly', 'project/python3', ''],
        ['relative -- under workspace root directly', 'project/my-venv/bin/python3', ''],
        ['relative -- at cwd', './python3', ''],
        ['relative -- under cwd', './my-venv/bin/python3', ''],
        ['relative -- outside cwd', '../my-venv/bin/python3', ''],

        // tslint:disable-next-line:prefer-template
        ['absolute - starts with workspace root', workspaceRoot + '/my-venv/bin/python3', 'my-venv/bin/python3'],
        ['absolute - does not start with workspace root', '/home/user/my-venv/bin/python3', '']
    ];
    for (let [testName, pythonPath, expected] of tests) {
        pythonPath = normalizeFilename(pythonPath);
        if (expected === '') {
            expected = pythonPath;
        } else {
            expected = normalizeFilename(expected);
        }
        test(`${testName} (${pythonPath} -> ${expected})`, async () => {
            setInfo('python');
            setExpected(expected);

            const updater = new WorkspacePythonPathUpdaterService(
                Uri.file(workspaceRoot),
                workspaceSvc.object
            );
            await updater.updatePythonPath(pythonPath);

            workspaceSvc.verifyAll();
            config.verifyAll();
        });
    }
});

// tslint:disable-next-line:max-func-body-length
suite('WorkspaceFolderPythonPathUpdaterService', () => {
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
            workspaceFolderValue: pythonPath
        };
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => info);
    }

    function setExpected(expected: string) {
        config.setup(c => c.update('pythonPath', expected, ConfigurationTarget.WorkspaceFolder))
            .returns(() => Promise.resolve());
    }

    test('not set at all', async () => {
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => undefined);
        setExpected('python3');

        const updater = new WorkspaceFolderPythonPathUpdaterService(
            Uri.file(__dirname),
            workspaceSvc.object
        );
        await updater.updatePythonPath('python3');

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('not set on workspace', async () => {
        setInfo(undefined);
        setExpected('python3');

        const updater = new WorkspaceFolderPythonPathUpdaterService(
            Uri.file(__dirname),
            workspaceSvc.object
        );
        await updater.updatePythonPath('python3');

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('not changed', async () => {
        setInfo('python3');

        const updater = new WorkspaceFolderPythonPathUpdaterService(
            Uri.file(__dirname),
            workspaceSvc.object
        );
        await updater.updatePythonPath('python3');

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    const workspaceRoot = normalizeFilename('/home/user/project');
    const tests: [string, string, string][] = [
        // (test name, new pythonPath, expected)
        // If "expected" is an empty string then the new pythonPath is used.
        ['on $PATH', 'python3', ''],
        ['under $HOME', '~/my-venv/bin/python3', ''],

        ['relative -- at workspace root', 'python3', ''],
        ['relative -- under workspace root', 'my-venv/bin/python3', ''],
        ['relative -- at workspace root directly', 'project/python3', ''],
        ['relative -- under workspace root directly', 'project/my-venv/bin/python3', ''],
        ['relative -- at cwd', './python3', ''],
        ['relative -- under cwd', './my-venv/bin/python3', ''],
        ['relative -- outside cwd', '../my-venv/bin/python3', ''],

        // tslint:disable-next-line:prefer-template
        ['absolute - starts with workspace root', workspaceRoot + '/my-venv/bin/python3', 'my-venv/bin/python3'],
        ['absolute - does not start with workspace root', '/home/user/my-venv/bin/python3', '']
    ];
    for (let [testName, pythonPath, expected] of tests) {
        pythonPath = normalizeFilename(pythonPath);
        if (expected === '') {
            expected = pythonPath;
        } else {
            expected = normalizeFilename(expected);
        }
        test(`${testName} (${pythonPath} -> ${expected})`, async () => {
            setInfo('python');
            setExpected(expected);

            const updater = new WorkspaceFolderPythonPathUpdaterService(
                Uri.file(workspaceRoot),
                workspaceSvc.object
            );
            await updater.updatePythonPath(pythonPath);

            workspaceSvc.verifyAll();
            config.verifyAll();
        });
    }
});
