// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify } from 'ts-mockito';
import { Uri } from 'vscode';
import { CommandManager } from '../../../client/common/application/commandManager';
import { Commands } from '../../../client/common/constants';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { CommandSource } from '../../../client/testing/common/constants';
import { TestsToRun } from '../../../client/testing/common/types';
import { onItemSelected, Type } from '../../../client/testing/display/picker';

// tslint:disable:no-any

suite('Unit Tests - Picker (execution of commands)', () => {
    getNamesAndValues<Type>(Type).forEach(item => {
        getNamesAndValues<CommandSource>(Type).forEach(commandSource => {
            [true, false].forEach(debug => {
                test(`Invoking command for selection ${item.name} from ${commandSource.name} (${debug ? 'Debug' : 'No debug'})`, async () => {
                    const commandManager = mock(CommandManager);
                    const workspaceUri = Uri.file(__filename);

                    const testFunction = 'some test Function';
                    const selection = { type: item.value, fn: { testFunction } };
                    onItemSelected(instance(commandManager), commandSource.value, workspaceUri, selection as any, debug);

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
                            verify(commandManager.executeCommand(Commands.Tests_Run, undefined, commandSource.value, workspaceUri, undefined)).once();
                            return;
                        }
                        case Type.ReDiscover: {
                            verify(commandManager.executeCommand(Commands.Tests_Discover, undefined, commandSource.value, workspaceUri)).once();
                            return;
                        }
                        case Type.ViewTestOutput: {
                            verify(commandManager.executeCommand(Commands.Tests_ViewOutput, undefined, commandSource.value)).once();
                            return;
                        }
                        case Type.RunFailed: {
                            verify(commandManager.executeCommand(Commands.Tests_Run_Failed, undefined, commandSource.value, workspaceUri)).once();
                            return;
                        }
                        case Type.SelectAndRunMethod: {
                            const cmd = debug ? Commands.Tests_Select_And_Debug_Method : Commands.Tests_Select_And_Run_Method;
                            verify(commandManager.executeCommand(cmd, undefined, commandSource.value, workspaceUri)).once();
                            return;
                        }
                        case Type.RunMethod: {
                            const testsToRun: TestsToRun = { testFunction: ['something' as any] };
                            verify(commandManager.executeCommand(Commands.Tests_Run, undefined, commandSource.value, workspaceUri, testsToRun)).never();
                            return;
                        }
                        case Type.DebugMethod: {
                            const testsToRun: TestsToRun = { testFunction: ['something' as any] };
                            verify(commandManager.executeCommand(Commands.Tests_Debug, undefined, commandSource.value, workspaceUri, testsToRun)).never();
                            return;
                        }
                        case Type.Configure: {
                            verify(commandManager.executeCommand(Commands.Tests_Configure, undefined, commandSource.value, workspaceUri)).once();
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
