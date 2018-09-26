// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../../client/common/application/types';
import {
    WorkspaceFolderPythonPathUpdaterService,
    WorkspacePythonPathUpdater,
    WorkspacePythonPathUpdaterService
} from '../../../../client/interpreter/configuration/services/workspaceUpdaterService';

// tslint:disable-next-line:max-func-body-length
suite('WorkspacePythonPathUpdater - normal operation', () => {
    let getConfig: TypeMoq.IMock<() => WorkspaceConfiguration>;
    let config: TypeMoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        // tslint:disable-next-line:no-object-literal-type-assertion
        getConfig = TypeMoq.Mock.ofInstance(() => { return {} as WorkspaceConfiguration; });
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);

        getConfig.setup(f => f())
            .returns(() => config.object);
    });

    test('not set at all', async () => {
        const python = path.sep + path.join('bin', 'python3');
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => undefined);
        config.setup(c => c.update('pythonPath', python, ConfigurationTarget.Workspace))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdater(
            Uri.file(__dirname),
            getConfig.object,
            ConfigurationTarget.Workspace
        );
        await updater.updatePythonPath(python);

        getConfig.verifyAll();
        config.verifyAll();
    });

    test('not set on workspace', async () => {
        const python = path.sep + path.join('bin', 'python3');
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                workspaceValue: undefined
            }));
        config.setup(c => c.update('pythonPath', python, ConfigurationTarget.Workspace))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdater(
            Uri.file(__dirname),
            getConfig.object,
            ConfigurationTarget.Workspace
        );
        await updater.updatePythonPath(python);

        getConfig.verifyAll();
        config.verifyAll();
    });

    test('not set except on workspace', async () => {
        const python = path.sep + path.join('bin', 'python3');
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                workspaceValue: python,  // if code wrong then won't update
                workspaceFolderValue: undefined
            }));
        config.setup(c => c.update('pythonPath', python, ConfigurationTarget.WorkspaceFolder))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdater(
            Uri.file(__dirname),
            getConfig.object,
            ConfigurationTarget.WorkspaceFolder
        );
        await updater.updatePythonPath(python);

        getConfig.verifyAll();
        config.verifyAll();
    });

    test('not set except on workspace folder', async () => {
        const python = path.sep + path.join('bin', 'python3');
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                workspaceValue: undefined,
                workspaceFolderValue: python  // if code wrong then won't update
            }));
        config.setup(c => c.update('pythonPath', python, ConfigurationTarget.Workspace))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdater(
            Uri.file(__dirname),
            getConfig.object,
            ConfigurationTarget.Workspace
        );
        await updater.updatePythonPath(python);

        getConfig.verifyAll();
        config.verifyAll();
    });

    test('not changed', async () => {
        const python = path.sep + path.join('bin', 'python3');
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                workspaceValue: python
            }));

        const updater = new WorkspacePythonPathUpdater(
            Uri.file(__dirname),
            getConfig.object,
            ConfigurationTarget.Workspace
        );
        await updater.updatePythonPath(python);

        getConfig.verifyAll();
        config.verifyAll();
    });

    const workspaceRoot = path.sep + path.join('root', 'some', 'project');
    const tests: [string, string, string][] = [
        // (test name, new pythonPath, expected)
        ['starts with workspace root',
         path.join(workspaceRoot, 'my-venv', 'bin', 'python3'),
         path.join('my-venv', 'bin', 'python3')],  // modified
        ['does not start with workspace root',
         path.sep + path.join('root', 'my-venv', 'bin', 'python3'),
         path.sep + path.join('root', 'my-venv', 'bin', 'python3')]  // not modified
    ];
    for (const [testName, pythonPath, expected] of tests) {
        test(`${testName} (${pythonPath} -> ${expected})`, async () => {
            config.setup(c => c.inspect<string>('pythonPath'))
                .returns(() => ({
                    key: 'python.pythonPath',
                    workspaceValue: 'python'
                }));
            config.setup(c => c.update('pythonPath', expected, ConfigurationTarget.Workspace))
                .returns(() => Promise.resolve());

            const updater = new WorkspacePythonPathUpdater(
                Uri.file(workspaceRoot),
                getConfig.object,
                ConfigurationTarget.Workspace
            );
            await updater.updatePythonPath(pythonPath);

            getConfig.verifyAll();
            config.verifyAll();
        });
    }
});

// tslint:disable-next-line:max-func-body-length
suite('WorkspacePythonPathUpdater - relative paths (allowed but discouraged)', () => {
    let getConfig: TypeMoq.IMock<() => WorkspaceConfiguration>;
    let config: TypeMoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        // tslint:disable-next-line:no-object-literal-type-assertion
        getConfig = TypeMoq.Mock.ofInstance(() => { return {} as WorkspaceConfiguration; });
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);

        getConfig.setup(f => f())
            .returns(() => config.object);
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                workspaceValue: 'python'
            }));
    });

    // Note that in every case we use the provided pythonPath as-is.

    const tests: [string, string][] = [
        // (test name, new pythonPath)
        ['on $PATH', 'python3'],
        ['under $HOME', path.join('~', 'my-venv', 'bin', 'python3')],

        ['implicitly relative', path.join('my-venv', 'bin', 'python3')],

        ['explicitly relative -- at cwd', path.join('.', 'python3')],
        ['explicitly relative -- under cwd', path.join('.', 'my-venv', 'bin', 'python3')],
        ['explicitly relative -- outside cwd', path.join('..', 'my-venv', 'bin', 'python3')]
    ];
    for (const [testName, pythonPath] of tests) {
        test(`${testName} (${pythonPath})`, async () => {
            config.setup(c => c.inspect<string>('pythonPath'))
                .returns(() => ({
                    key: 'python.pythonPath',
                    workspaceValue: 'python'
                }));
            config.setup(c => c.update('pythonPath', pythonPath, ConfigurationTarget.Workspace))
                .returns(() => Promise.resolve());

            const workspaceRoot = path.sep + path.join('root', 'some', 'project');
            const updater = new WorkspacePythonPathUpdater(
                Uri.file(workspaceRoot),
                getConfig.object,
                ConfigurationTarget.Workspace
            );
            await updater.updatePythonPath(pythonPath);

            getConfig.verifyAll();
            config.verifyAll();
        });
    }
});

// tslint:disable-next-line:max-func-body-length
suite('WorkspacePythonPathUpdaterService', () => {
    let workspaceSvc: TypeMoq.IMock<IWorkspaceService>;
    let config: TypeMoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        workspaceSvc = TypeMoq.Mock.ofType<IWorkspaceService>(undefined, TypeMoq.MockBehavior.Strict);
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);

        workspaceSvc.setup(w => w.getConfiguration('python', TypeMoq.It.isAny()))
            .returns(() => config.object);
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                workspaceValue: 'python'
            }));
    });

    test('starts with workspace root', async () => {
        const root = path.sep + path.join('some', 'project');
        const expected = path.join('my-venv', 'bin', 'python3');
        config.setup(c => c.update('pythonPath', expected, ConfigurationTarget.Workspace))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file(root),
            workspaceSvc.object
        );
        await updater.updatePythonPath(path.join(root, expected));

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('does not start with workspace root', async () => {
        const root = path.sep + path.join('root', 'some', 'project');
        const expected = path.sep + path.join('root', 'my-venv', 'bin', 'python3');
        config.setup(c => c.update('pythonPath', expected, ConfigurationTarget.Workspace))
            .returns(() => Promise.resolve());

        const updater = new WorkspacePythonPathUpdaterService(
            Uri.file(root),
            workspaceSvc.object
        );
        await updater.updatePythonPath(expected);

        workspaceSvc.verifyAll();
        config.verifyAll();
    });
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
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                workspaceFolderValue: 'python'
            }));
    });

    test('starts with workspace root', async () => {
        const root = path.sep + path.join('some', 'project');
        const expected = path.join('my-venv', 'bin', 'python3');
        config.setup(c => c.update('pythonPath', expected, ConfigurationTarget.WorkspaceFolder))
            .returns(() => Promise.resolve());

        const updater = new WorkspaceFolderPythonPathUpdaterService(
            Uri.file(root),
            workspaceSvc.object
        );
        await updater.updatePythonPath(path.join(root, expected));

        workspaceSvc.verifyAll();
        config.verifyAll();
    });

    test('does not start with workspace root', async () => {
        const root = path.sep + path.join('root', 'some', 'project');
        const expected = path.sep + path.join('root', 'my-venv', 'bin', 'python3');
        config.setup(c => c.update('pythonPath', expected, ConfigurationTarget.WorkspaceFolder))
            .returns(() => Promise.resolve());

        const updater = new WorkspaceFolderPythonPathUpdaterService(
            Uri.file(root),
            workspaceSvc.object
        );
        await updater.updatePythonPath(expected);

        workspaceSvc.verifyAll();
        config.verifyAll();
    });
});
