// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-multiline-string no-trailing-whitespace

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Disposable, Uri, WorkspaceFolder } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../../client/common/application/types';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { ITerminalService, ITerminalServiceFactory } from '../../../client/common/terminal/types';
import { IConfigurationService, IPythonSettings, ITerminalSettings } from '../../../client/common/types';
import { DjangoShellCodeExecutionProvider } from '../../../client/terminals/codeExecution/djangoShellCodeExecution';
import { ReplProvider } from '../../../client/terminals/codeExecution/repl';
import { TerminalCodeExecutionProvider } from '../../../client/terminals/codeExecution/terminalCodeExecution';
import { ICodeExecutionService } from '../../../client/terminals/types';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Code Execution', () => {
    // tslint:disable-next-line:max-func-body-length
    ['Terminal Execution', 'Repl Execution', 'Django Execution'].forEach(testSuiteName => {
        let terminalSettings: TypeMoq.IMock<ITerminalSettings>;
        let terminalService: TypeMoq.IMock<ITerminalService>;
        let workspace: TypeMoq.IMock<IWorkspaceService>;
        let platform: TypeMoq.IMock<IPlatformService>;
        let workspaceFolder: TypeMoq.IMock<WorkspaceFolder>;
        let settings: TypeMoq.IMock<IPythonSettings>;
        let disposables: Disposable[] = [];
        let executor: ICodeExecutionService;
        let expectedTerminalTitle: string | undefined;
        let terminalFactory: TypeMoq.IMock<ITerminalServiceFactory>;
        let documentManager: TypeMoq.IMock<IDocumentManager>;
        let commandManager: TypeMoq.IMock<ICommandManager>;
        let fileSystem: TypeMoq.IMock<IFileSystem>;
        let isDjangoRepl: boolean;

        teardown(() => {
            disposables.forEach(disposable => {
                if (disposable) {
                    disposable.dispose();
                }
            });

            disposables = [];
        });

        // tslint:disable-next-line:max-func-body-length
        setup(() => {
            terminalFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
            terminalSettings = TypeMoq.Mock.ofType<ITerminalSettings>();
            terminalService = TypeMoq.Mock.ofType<ITerminalService>();
            const configService = TypeMoq.Mock.ofType<IConfigurationService>();
            workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
            platform = TypeMoq.Mock.ofType<IPlatformService>();
            workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
            documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
            commandManager = TypeMoq.Mock.ofType<ICommandManager>();
            fileSystem = TypeMoq.Mock.ofType<IFileSystem>();

            settings = TypeMoq.Mock.ofType<IPythonSettings>();
            settings.setup(s => s.terminal).returns(() => terminalSettings.object);
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);

            switch (testSuiteName) {
                case 'Terminal Execution': {
                    executor = new TerminalCodeExecutionProvider(terminalFactory.object, configService.object, workspace.object, disposables, platform.object);
                    break;
                }
                case 'Repl Execution': {
                    executor = new ReplProvider(terminalFactory.object, configService.object, workspace.object, disposables, platform.object);
                    expectedTerminalTitle = 'REPL';
                    break;
                }
                case 'Django Execution': {
                    isDjangoRepl = true;
                    workspace.setup(w => w.onDidChangeWorkspaceFolders(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
                        // tslint:disable-next-line:no-empty
                        return { dispose: () => { } };
                    });
                    executor = new DjangoShellCodeExecutionProvider(terminalFactory.object, configService.object, workspace.object, documentManager.object,
                        platform.object, commandManager.object, fileSystem.object, disposables);
                    expectedTerminalTitle = 'Django Shell';
                    break;
                }
                default: {
                    break;
                }
            }
            // replExecutor = new TerminalCodeExecutionProvider(terminalFactory.object, configService.object, workspace.object, disposables, platform.object);
        });

        suite(`${testSuiteName} (validation of title)`, () => {
            setup(() => {
                terminalFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny(), TypeMoq.It.isValue(expectedTerminalTitle))).returns(() => terminalService.object);
            });

            async function ensureTerminalIsCreatedUponInvokingInitializeRepl(isWindows: boolean, isOsx: boolean, isLinux: boolean): Promise<void> {
                platform.setup(p => p.isWindows).returns(() => isWindows);
                platform.setup(p => p.isMac).returns(() => isOsx);
                platform.setup(p => p.isLinux).returns(() => isLinux);
                settings.setup(s => s.pythonPath).returns(() => 'python');
                terminalSettings.setup(t => t.launchArgs).returns(() => []);

                await executor.initializeRepl();
            }

            test('Ensure terminal is created upon invoking initializeRepl (windows)', async () => {
                await ensureTerminalIsCreatedUponInvokingInitializeRepl(true, false, false);
            });

            test('Ensure terminal is created upon invoking initializeRepl (osx)', async () => {
                await ensureTerminalIsCreatedUponInvokingInitializeRepl(false, true, false);
            });

            test('Ensure terminal is created upon invoking initializeRepl (linux)', async () => {
                await ensureTerminalIsCreatedUponInvokingInitializeRepl(false, false, true);
            });
        });

        // tslint:disable-next-line:max-func-body-length
        suite(testSuiteName, () => {
            setup(() => {
                terminalFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => terminalService.object);
            });

            async function ensureWeSetCurrentDirectoryBeforeExecutingAFile(isWindows: boolean): Promise<void> {
                const file = Uri.file(path.join('c', 'path', 'to', 'file', 'one.py'));
                terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
                workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
                workspaceFolder.setup(w => w.uri).returns(() => Uri.file(path.join('c', 'path', 'to')));
                platform.setup(p => p.isWindows).returns(() => false);
                settings.setup(s => s.pythonPath).returns(() => 'python');
                terminalSettings.setup(t => t.launchArgs).returns(() => []);

                await executor.executeFile(file);

                terminalService.verify(async t => await t.sendText(TypeMoq.It.isValue(`cd ${path.dirname(file.fsPath).fileToCommandArgument()}`)), TypeMoq.Times.once());
            }
            test('Ensure we set current directory before executing file (non windows)', async () => {
                await ensureWeSetCurrentDirectoryBeforeExecutingAFile(false);
            });
            test('Ensure we set current directory before executing file (windows)', async () => {
                await ensureWeSetCurrentDirectoryBeforeExecutingAFile(true);
            });

            async function ensureWeWetCurrentDirectoryAndQuoteBeforeExecutingFile(isWindows: boolean): Promise<void> {
                const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
                workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
                workspaceFolder.setup(w => w.uri).returns(() => Uri.file(path.join('c', 'path', 'to')));
                platform.setup(p => p.isWindows).returns(() => isWindows);
                settings.setup(s => s.pythonPath).returns(() => 'python');
                terminalSettings.setup(t => t.launchArgs).returns(() => []);

                await executor.executeFile(file);
                const dir = path.dirname(file.fsPath).fileToCommandArgument();
                terminalService.verify(async t => await t.sendText(TypeMoq.It.isValue(`cd ${dir}`)), TypeMoq.Times.once());
            }

            test('Ensure we set current directory (and quote it when containing spaces) before executing file (non windows)', async () => {
                await ensureWeWetCurrentDirectoryAndQuoteBeforeExecutingFile(false);
            });

            test('Ensure we set current directory (and quote it when containing spaces) before executing file (windows)', async () => {
                await ensureWeWetCurrentDirectoryAndQuoteBeforeExecutingFile(true);
            });

            async function ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileInSameDirectory(isWindows: boolean): Promise<void> {
                const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
                workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
                workspaceFolder.setup(w => w.uri).returns(() => Uri.file(path.join('c', 'path', 'to', 'file with spaces in path')));
                platform.setup(p => p.isWindows).returns(() => isWindows);
                settings.setup(s => s.pythonPath).returns(() => 'python');
                terminalSettings.setup(t => t.launchArgs).returns(() => []);

                await executor.executeFile(file);

                terminalService.verify(async t => await t.sendText(TypeMoq.It.isAny()), TypeMoq.Times.never());
            }
            test('Ensure we do not set current directory before executing file if in the same directory (non windows)', async () => {
                await ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileInSameDirectory(false);
            });
            test('Ensure we do not set current directory before executing file if in the same directory (windows)', async () => {
                await ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileInSameDirectory(true);
            });

            async function ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileNotInSameDirectory(isWindows: boolean): Promise<void> {
                const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
                workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);
                platform.setup(p => p.isWindows).returns(() => isWindows);
                settings.setup(s => s.pythonPath).returns(() => 'python');
                terminalSettings.setup(t => t.launchArgs).returns(() => []);

                await executor.executeFile(file);

                terminalService.verify(async t => await t.sendText(TypeMoq.It.isAny()), TypeMoq.Times.never());
            }
            test('Ensure we do not set current directory before executing file if file is not in a workspace (non windows)', async () => {
                await ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileNotInSameDirectory(false);
            });
            test('Ensure we do not set current directory before executing file if file is not in a workspace (windows)', async () => {
                await ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileNotInSameDirectory(true);
            });

            async function testFileExecution(isWindows: boolean, pythonPath: string, terminalArgs: string[], file: Uri): Promise<void> {
                platform.setup(p => p.isWindows).returns(() => isWindows);
                settings.setup(s => s.pythonPath).returns(() => pythonPath);
                terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);
                terminalSettings.setup(t => t.executeInFileDir).returns(() => false);
                workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);

                await executor.executeFile(file);
                const expectedPythonPath = isWindows ? pythonPath.replace(/\\/g, '/') : pythonPath;
                const expectedArgs = terminalArgs.concat(file.fsPath.fileToCommandArgument());
                terminalService.verify(async t => await t.sendCommand(TypeMoq.It.isValue(expectedPythonPath), TypeMoq.It.isValue(expectedArgs)), TypeMoq.Times.once());
            }

            test('Ensure python file execution script is sent to terminal on windows', async () => {
                const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                await testFileExecution(true, 'python', [], file);
            });

            test('Ensure python file execution script is sent to terminal on windows with fully qualified python path', async () => {
                const file = Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                await testFileExecution(true, 'c:\\program files\\python', [], file);
            });

            test('Ensure python file execution script is not quoted when no spaces in file path', async () => {
                const file = Uri.file(path.join('c', 'path', 'to', 'file', 'one.py'));
                await testFileExecution(true, 'python', [], file);
            });

            test('Ensure python file execution script supports custom python arguments', async () => {
                const file = Uri.file(path.join('c', 'path', 'to', 'file', 'one.py'));
                await testFileExecution(false, 'python', ['-a', '-b', '-c'], file);
            });

            function testReplCommandArguments(isWindows: boolean, pythonPath: string, expectedPythonPath: string, terminalArgs: string[]) {
                platform.setup(p => p.isWindows).returns(() => isWindows);
                settings.setup(s => s.pythonPath).returns(() => pythonPath);
                terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);
                const expectedTerminalArgs = isDjangoRepl ? terminalArgs.concat(['manage.py', 'shell']) : terminalArgs;

                const replCommandArgs = (executor as TerminalCodeExecutionProvider).getReplCommandArgs();
                expect(replCommandArgs).not.to.be.an('undefined', 'Command args is undefined');
                expect(replCommandArgs.command).to.be.equal(expectedPythonPath, 'Incorrect python path');
                expect(replCommandArgs.args).to.be.deep.equal(expectedTerminalArgs, 'Incorrect arguments');
            }

            test('Ensure fully qualified python path is escaped when building repl args on Windows', () => {
                const pythonPath = 'c:\\program files\\python\\python.exe';
                const terminalArgs = ['-a', 'b', 'c'];

                testReplCommandArguments(true, pythonPath, 'c:/program files/python/python.exe', terminalArgs);
            });

            test('Ensure fully qualified python path is returned as is, when building repl args on Windows', () => {
                const pythonPath = 'c:/program files/python/python.exe';
                const terminalArgs = ['-a', 'b', 'c'];

                testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs);
            });

            test('Ensure python path is returned as is, when building repl args on Windows', () => {
                const pythonPath = 'python';
                const terminalArgs = ['-a', 'b', 'c'];

                testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs);
            });

            test('Ensure fully qualified python path is returned as is, on non Windows', () => {
                const pythonPath = 'usr/bin/python';
                const terminalArgs = ['-a', 'b', 'c'];

                testReplCommandArguments(false, pythonPath, pythonPath, terminalArgs);
            });

            test('Ensure python path is returned as is, on non Windows', () => {
                const pythonPath = 'python';
                const terminalArgs = ['-a', 'b', 'c'];

                testReplCommandArguments(false, pythonPath, pythonPath, terminalArgs);
            });

            test('Ensure nothing happens when blank text is sent to the terminal', async () => {
                await executor.execute('');
                await executor.execute('   ');
                // tslint:disable-next-line:no-any
                await executor.execute(undefined as any as string);

                terminalService.verify(async t => await t.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
                terminalService.verify(async t => await t.sendText(TypeMoq.It.isAny()), TypeMoq.Times.never());
            });

            test('Ensure repl is initialized once before sending text to the repl', async () => {
                const pythonPath = 'usr/bin/python1234';
                const terminalArgs = ['-a', 'b', 'c'];

                platform.setup(p => p.isWindows).returns(() => false);
                settings.setup(s => s.pythonPath).returns(() => pythonPath);
                terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);

                await executor.execute('cmd1');
                await executor.execute('cmd2');
                await executor.execute('cmd3');

                const expectedTerminalArgs = isDjangoRepl ? terminalArgs.concat(['manage.py', 'shell']) : terminalArgs;
                terminalService.verify(async t => await t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(expectedTerminalArgs)), TypeMoq.Times.once());
            });

            test('Ensure repl is re-initialized when temrinal is closed', async () => {
                const pythonPath = 'usr/bin/python1234';
                const terminalArgs = ['-a', 'b', 'c'];
                platform.setup(p => p.isWindows).returns(() => false);
                settings.setup(s => s.pythonPath).returns(() => pythonPath);
                terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);

                let closeTerminalCallback: undefined | (() => void);
                terminalService.setup(t => t.onDidCloseTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((callback => {
                    closeTerminalCallback = callback;
                    return {
                        // tslint:disable-next-line:no-empty
                        dispose: () => void 0
                    };
                }));

                await executor.execute('cmd1');
                await executor.execute('cmd2');
                await executor.execute('cmd3');

                const expectedTerminalArgs = isDjangoRepl ? terminalArgs.concat(['manage.py', 'shell']) : terminalArgs;

                expect(closeTerminalCallback).not.to.be.an('undefined', 'Callback not initialized');
                terminalService.verify(async t => await t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(expectedTerminalArgs)), TypeMoq.Times.once());

                closeTerminalCallback!.call(terminalService.object);
                await executor.execute('cmd4');
                terminalService.verify(async t => await t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(expectedTerminalArgs)), TypeMoq.Times.exactly(2));

                closeTerminalCallback!.call(terminalService.object);
                await executor.execute('cmd5');
                terminalService.verify(async t => await t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(expectedTerminalArgs)), TypeMoq.Times.exactly(3));
            });

            test('Ensure code is sent to terminal', async () => {
                const pythonPath = 'usr/bin/python1234';
                const terminalArgs = ['-a', 'b', 'c'];
                platform.setup(p => p.isWindows).returns(() => false);
                settings.setup(s => s.pythonPath).returns(() => pythonPath);
                terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);

                await executor.execute('cmd1');
                terminalService.verify(async t => await t.sendText('cmd1'), TypeMoq.Times.once());

                await executor.execute('cmd2');
                terminalService.verify(async t => await t.sendText('cmd2'), TypeMoq.Times.once());
            });
        });
    });
});
