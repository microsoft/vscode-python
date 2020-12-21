// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { CommandSource } from '../../../client/testing/common/constants';
import { TestCollectionStorageService } from '../../../client/testing/common/services/storageService';
import { ITestCollectionStorageService, TestFunction, Tests, TestsToRun } from '../../../client/testing/common/types';
import { onItemSelected, TestDisplay, Type } from '../../../client/testing/display/picker';
import { createEmptyResults } from '../results';

suite('Unit Tests - Picker (execution of commands)', () => {
    getNamesAndValues<Type>(Type).forEach((item) => {
        getNamesAndValues<CommandSource>(CommandSource).forEach((commandSource) => {
            [true, false].forEach((debug) => {
                test(`Invoking command for selection ${item.name} from ${commandSource.name} (${
                    debug ? 'Debug' : 'No debug'
                })`, async () => {
                    const commandManager = mock(CommandManager);
                    const workspaceUri = Uri.file(__filename);

                    const testFunction = 'some test Function';
                    const testFunctions = [
                        {
                            name: 'some_name',
                            nameToRun: 'some_name_to_run',
                            time: 0,
                            resource: workspaceUri,
                        },
                    ];
                    const selection = { type: item.value, fn: { testFunction }, fns: testFunctions };

                    // Getting the value of CommandSource.commandPalette in getNamesAndValues(CommandSource)
                    // fails because the names and values object is build by accessing the CommandSource enum
                    // properties by value. In case of commandpalette the property is commandPalette and the
                    // respective value is commandpalette which do not match and thus return undefined for value.
                    if (commandSource.name === 'commandpalette') {
                        commandSource.value = CommandSource.commandPalette;
                    }

                    onItemSelected(
                        instance(commandManager),
                        commandSource.value,
                        workspaceUri,
                        selection as any,
                        debug,
                    );

                    switch (selection.type) {
                        case Type.Null: {
                            verify(commandManager.executeCommand(anything())).never();
                            const args: any[] = [];
                            for (let i = 0; i <= 7; i += 1) {
                                args.push(anything());
                            }
                            verify(commandManager.executeCommand(anything(), ...args)).never();
                            return;
                        }
                        case Type.RunAll: {
                            verify(
                                commandManager.executeCommand(
                                    Commands.Tests_Run,
                                    undefined,
                                    commandSource.value,
                                    workspaceUri,
                                    undefined,
                                ),
                            ).once();
                            return;
                        }
                        case Type.RunParametrized: {
                            verify(
                                commandManager.executeCommand(
                                    Commands.Tests_Run_Parametrized,
                                    undefined,
                                    commandSource.value,
                                    workspaceUri,
                                    selection.fns,
                                    debug,
                                ),
                            ).once();
                            return;
                        }
                        case Type.ReDiscover: {
                            verify(
                                commandManager.executeCommand(
                                    Commands.Tests_Discover,
                                    undefined,
                                    commandSource.value,
                                    workspaceUri,
                                ),
                            ).once();
                            return;
                        }
                        case Type.ViewTestOutput: {
                            verify(
                                commandManager.executeCommand(
                                    Commands.Tests_ViewOutput,
                                    undefined,
                                    commandSource.value,
                                ),
                            ).once();
                            return;
                        }
                        case Type.RunFailed: {
                            verify(
                                commandManager.executeCommand(
                                    Commands.Tests_Run_Failed,
                                    undefined,
                                    commandSource.value,
                                    workspaceUri,
                                ),
                            ).once();
                            return;
                        }
                        case Type.SelectAndRunMethod: {
                            const cmd = debug
                                ? Commands.Tests_Select_And_Debug_Method
                                : Commands.Tests_Select_And_Run_Method;
                            verify(
                                commandManager.executeCommand(cmd, undefined, commandSource.value, workspaceUri),
                            ).once();
                            return;
                        }
                        case Type.RunMethod: {
                            const testsToRun: TestsToRun = { testFunction: ['something' as any] };
                            verify(
                                commandManager.executeCommand(
                                    Commands.Tests_Run,
                                    undefined,
                                    commandSource.value,
                                    workspaceUri,
                                    testsToRun,
                                ),
                            ).never();
                            return;
                        }
                        case Type.DebugMethod: {
                            const testsToRun: TestsToRun = { testFunction: ['something' as any] };
                            verify(
                                commandManager.executeCommand(
                                    Commands.Tests_Debug,
                                    undefined,
                                    commandSource.value,
                                    workspaceUri,
                                    testsToRun,
                                ),
                            ).never();
                            return;
                        }
                        case Type.Configure: {
                            verify(
                                commandManager.executeCommand(
                                    Commands.Tests_Configure,
                                    undefined,
                                    commandSource.value,
                                    workspaceUri,
                                ),
                            ).once();
                            return;
                        }
                        default: {
                            return;
                        }
                    }
                });
            });
        });
    });
});

suite('Testing - TestDisplay', () => {
    const wkspace = Uri.file(__dirname);
    let mockedCommandManager: ICommandManager;
    let mockedServiceContainer: IServiceContainer;
    let mockedTestCollectionStorage: ITestCollectionStorageService;
    let mockedAppShell: IApplicationShell;
    let mockedFileSytem: IFileSystem;
    let testDisplay: TestDisplay;

    function fullPathInTests(collectedTests: Tests, fullpath?: string): Tests {
        collectedTests.testFiles = [
            {
                fullPath: fullpath ? fullpath : 'path/to/testfile',
                ...anything(),
            },
        ];
        return collectedTests;
    }

    setup(() => {
        mockedCommandManager = mock(CommandManager);
        mockedServiceContainer = mock(ServiceContainer);
        mockedTestCollectionStorage = mock(TestCollectionStorageService);
        mockedAppShell = mock(ApplicationShell);
        when(mockedServiceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService)).thenReturn(
            instance(mockedTestCollectionStorage),
        );
        when(mockedServiceContainer.get<IApplicationShell>(IApplicationShell)).thenReturn(instance(mockedAppShell));

        testDisplay = new TestDisplay(instance(mockedServiceContainer), instance(mockedCommandManager));
    });

    suite('displayFunctionTestPickerUI', () => {
        const fileName = Uri.file('path/to/testfile');
        let tests: Tests;

        function codeLensTestFunctions(testfunctions?: TestFunction[]): TestFunction[] {
            if (!testfunctions) {
                return [{ ...anything() }];
            }
            const functions: TestFunction[] = [];
            testfunctions.forEach((fn) => functions.push(fn));
            return functions;
        }

        setup(() => {
            tests = createEmptyResults();
            mockedFileSytem = mock(FileSystem);
            when(mockedServiceContainer.get<IFileSystem>(IFileSystem)).thenReturn(instance(mockedFileSytem));
            when(mockedTestCollectionStorage.getTests(wkspace)).thenReturn(tests);
            when(mockedAppShell.showQuickPick(anything(), anything())).thenResolve();
        });

        test(`Test that a dropdown picker for parametrized tests is shown if compared paths are equal (#8627)`, () => {
            fullPathInTests(tests);
            when(mockedFileSytem.arePathsSame(anything(), anything())).thenReturn(true);

            testDisplay.displayFunctionTestPickerUI(
                CommandSource.commandPalette,
                wkspace,
                'rootDirectory',
                fileName,
                codeLensTestFunctions(),
            );

            verify(mockedAppShell.showQuickPick(anything(), anything())).once();
        });

        test(`Test that a dropdown picker for parametrized tests is NOT shown if compared paths are NOT equal (#8627)`, () => {
            fullPathInTests(tests);
            when(mockedFileSytem.arePathsSame(anything(), anything())).thenReturn(false);

            testDisplay.displayFunctionTestPickerUI(
                CommandSource.commandPalette,
                wkspace,
                'rootDirectory',
                fileName,
                codeLensTestFunctions(),
            );

            verify(mockedAppShell.showQuickPick(anything(), anything())).never();
        });
    });
});
