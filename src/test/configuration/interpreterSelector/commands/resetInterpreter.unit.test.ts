// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { Interpreters } from '../../../../client/common/utils/localize';
import { ResetInterpreterCommand } from '../../../../client/interpreter/configuration/interpreterSelector/commands/resetInterpreter';
import { IPythonPathUpdaterServiceManager } from '../../../../client/interpreter/configuration/types';

// tslint:disable-next-line:max-func-body-length
suite('Reset Interpreter Command', () => {
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let pythonPathUpdater: TypeMoq.IMock<IPythonPathUpdaterServiceManager>;
    const folder1 = { name: 'one', uri: Uri.parse('one'), index: 1 };
    const folder2 = { name: 'two', uri: Uri.parse('two'), index: 2 };

    let resetInterpreterCommand: ResetInterpreterCommand;

    setup(() => {
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        pythonPathUpdater = TypeMoq.Mock.ofType<IPythonPathUpdaterServiceManager>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();

        resetInterpreterCommand = new ResetInterpreterCommand(
            pythonPathUpdater.object,
            commandManager.object,
            appShell.object,
            workspace.object
        );
    });

    // tslint:disable-next-line: max-func-body-length
    suite('Test method resetInterpreter()', async () => {
        test('Update Global settings when there are no workspaces', async () => {
            workspace.setup((w) => w.workspaceFolders).returns(() => undefined);

            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(undefined),
                        TypeMoq.It.isValue(ConfigurationTarget.Global),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(undefined)
                    )
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await resetInterpreterCommand.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Update workspace folder settings when there is one workspace folder and no workspace file', async () => {
            const folder = { name: 'one', uri: Uri.parse('one'), index: 0 };
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder]);
            workspace.setup((w) => w.workspaceFile).returns(() => undefined);

            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(undefined),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder.uri)
                    )
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await resetInterpreterCommand.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Update selected workspace folder settings when there is more than one workspace folder', async () => {
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);
            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri
                }
            ];
            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() =>
                    Promise.resolve({
                        label: 'two',
                        description: path.dirname(folder2.uri.fsPath),
                        uri: folder2.uri
                    })
                )
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(undefined),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder2.uri)
                    )
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await resetInterpreterCommand.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Update entire workspace settings when there is more than one workspace folder and `Entire workspace` is selected', async () => {
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);
            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri
                }
            ];
            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() =>
                    Promise.resolve({
                        label: Interpreters.entireWorkspace(),
                        uri: folder1.uri
                    })
                )
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(undefined),
                        TypeMoq.It.isValue(ConfigurationTarget.Workspace),
                        TypeMoq.It.isValue('ui'),
                        TypeMoq.It.isValue(folder1.uri)
                    )
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await resetInterpreterCommand.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
        test('Do not update anything when user does not select a workspace folder and there is more than one workspace folder', async () => {
            workspace.setup((w) => w.workspaceFolders).returns(() => [folder1, folder2]);

            const expectedItems = [
                {
                    label: 'one',
                    description: path.dirname(folder1.uri.fsPath),
                    uri: folder1.uri
                },
                {
                    label: 'two',
                    description: path.dirname(folder2.uri.fsPath),
                    uri: folder2.uri
                },
                {
                    label: Interpreters.entireWorkspace(),
                    uri: folder1.uri
                }
            ];

            appShell
                .setup((s) => s.showQuickPick(TypeMoq.It.isValue(expectedItems), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            pythonPathUpdater
                .setup((p) =>
                    p.updatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());

            await resetInterpreterCommand.resetInterpreter();

            appShell.verifyAll();
            workspace.verifyAll();
            pythonPathUpdater.verifyAll();
        });
    });
});
