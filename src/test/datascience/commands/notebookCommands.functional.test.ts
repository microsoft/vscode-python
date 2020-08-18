// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { Kernel } from '@jupyterlab/services/lib/kernel/kernel';
import { assert } from 'chai';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, Uri } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { Architecture } from '../../../client/common/utils/platform';
import { NotebookCommands } from '../../../client/datascience/commands/notebookCommands';
import { Commands } from '../../../client/datascience/constants';
import { NotebookProvider } from '../../../client/datascience/interactive-common/notebookProvider';
import { InteractiveWindowProvider } from '../../../client/datascience/interactive-window/interactiveWindowProvider';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import { JupyterSessionManagerFactory } from '../../../client/datascience/jupyter/jupyterSessionManagerFactory';
import { KernelDependencyService } from '../../../client/datascience/jupyter/kernels/kernelDependencyService';
import { KernelSelectionProvider } from '../../../client/datascience/jupyter/kernels/kernelSelections';
import { KernelSelector } from '../../../client/datascience/jupyter/kernels/kernelSelector';
import { KernelService } from '../../../client/datascience/jupyter/kernels/kernelService';
import { KernelSwitcher } from '../../../client/datascience/jupyter/kernels/kernelSwitcher';
import {
    IKernelSpecQuickPickItem,
    KernelSpecConnectionMetadata,
    LiveKernelConnectionMetadata,
    PythonKernelConnectionMetadata
} from '../../../client/datascience/jupyter/kernels/types';
import { IKernelFinder } from '../../../client/datascience/kernel-launcher/types';
import { NativeEditorProvider } from '../../../client/datascience/notebookStorage/nativeEditorProvider';
import { IInteractiveWindowProvider, INotebookEditorProvider } from '../../../client/datascience/types';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { EnvironmentType } from '../../../client/pythonEnvironments/info';

// tslint:disable: max-func-body-length no-any
suite('DataScience - Notebook Commands', () => {
    let notebookCommands: NotebookCommands;
    let commandManager: ICommandManager;
    let interactiveWindowProvider: IInteractiveWindowProvider;
    let notebookEditorProvider: INotebookEditorProvider;
    let notebookProvider: NotebookProvider;
    let kernelSelectionProvider: KernelSelectionProvider;
    const remoteKernel = {
        lastActivityTime: new Date(),
        name: 'CurrentKernel',
        numberOfConnections: 0,
        id: '2232',
        // tslint:disable-next-line: no-any
        session: {} as any
    };
    const localKernel = {
        name: 'CurrentKernel',
        language: 'python',
        path: 'python',
        display_name: 'CurrentKernel',
        env: {},
        argv: []
    };
    const selectedInterpreter = {
        path: '',
        envType: EnvironmentType.Conda,
        architecture: Architecture.Unknown,
        sysPrefix: '',
        sysVersion: ''
    };
    const remoteSelections: IKernelSpecQuickPickItem<LiveKernelConnectionMetadata>[] = [
        {
            label: 'foobar',
            selection: {
                kernelModel: remoteKernel,
                interpreter: undefined,
                kind: 'connectToLiveKernel'
            }
        }
    ];
    const localSelections: IKernelSpecQuickPickItem<KernelSpecConnectionMetadata | PythonKernelConnectionMetadata>[] = [
        {
            label: 'foobar',
            selection: {
                kernelSpec: localKernel,
                kernelModel: undefined,
                interpreter: undefined,
                kind: 'startUsingKernelSpec'
            }
        },
        {
            label: 'foobaz',
            selection: {
                kernelSpec: undefined,
                interpreter: selectedInterpreter,
                kind: 'startUsingPythonInterpreter'
            }
        }
    ];

    [true, false].forEach((isLocalConnection) => {
        // tslint:disable-next-line: max-func-body-length
        suite(isLocalConnection ? 'Local Connection' : 'Remote Connection', () => {
            setup(() => {
                interactiveWindowProvider = mock(InteractiveWindowProvider);
                notebookEditorProvider = mock(NativeEditorProvider);
                notebookProvider = mock(NotebookProvider);
                commandManager = mock(CommandManager);

                const kernelDependencyService = mock(KernelDependencyService);
                const kernelService = mock(KernelService);
                kernelSelectionProvider = mock(KernelSelectionProvider);
                when(
                    kernelSelectionProvider.getKernelSelectionsForLocalSession(
                        anything(),
                        anything(),
                        anything(),
                        anything()
                    )
                ).thenResolve(localSelections);
                when(
                    kernelSelectionProvider.getKernelSelectionsForRemoteSession(anything(), anything(), anything())
                ).thenResolve(remoteSelections);
                const appShell = mock(ApplicationShell);
                const dependencyService = mock(KernelDependencyService);
                const interpreterService = mock(InterpreterService);
                const kernelFinder = mock<IKernelFinder>();
                const jupyterSessionManagerFactory = mock(JupyterSessionManagerFactory);
                const dummySessionEvent = new EventEmitter<Kernel.IKernelConnection>();
                when(jupyterSessionManagerFactory.onRestartSessionCreated).thenReturn(dummySessionEvent.event);
                when(jupyterSessionManagerFactory.onRestartSessionUsed).thenReturn(dummySessionEvent.event);
                when(appShell.showQuickPick(anything(), anything(), anything())).thenCall(() => {
                    return isLocalConnection ? localSelections[0] : remoteSelections[0];
                });
                when(appShell.withProgress(anything(), anything())).thenCall((_o, t) => {
                    return t();
                });
                when(notebookProvider.connect(anything())).thenResolve(
                    isLocalConnection ? ({ type: 'raw' } as any) : ({ type: 'jupyter' } as any)
                );

                const configService = mock(ConfigurationService);
                // tslint:disable-next-line: no-http-string
                const settings = { datascience: { jupyterServerURI: isLocalConnection ? 'local' : 'http://foobar' } };
                when(configService.getSettings(anything())).thenReturn(settings as any);

                const kernelSelector = new KernelSelector(
                    instance(kernelSelectionProvider),
                    instance(appShell),
                    instance(kernelService),
                    instance(interpreterService),
                    instance(dependencyService),
                    instance(kernelFinder),
                    instance(jupyterSessionManagerFactory),
                    instance(configService),
                    []
                );

                const kernelSwitcher = new KernelSwitcher(
                    instance(configService),
                    instance(appShell),
                    instance(kernelDependencyService),
                    kernelSelector
                );

                notebookCommands = new NotebookCommands(
                    instance(commandManager),
                    instance(notebookEditorProvider),
                    instance(interactiveWindowProvider),
                    instance(notebookProvider),
                    kernelSelector,
                    kernelSwitcher
                );
            });

            function createNotebookMock() {
                const obj = mock(JupyterNotebookBase);
                when((obj as any).then).thenReturn(undefined);
                return obj;
            }
            function verifyCallToSetKernelSpec(notebook: JupyterNotebookBase) {
                verify(notebook.setKernelConnection(anything(), anything())).once();

                const kernelConnection = capture(notebook.setKernelConnection).first()[0];
                if (isLocalConnection) {
                    assert.equal(kernelConnection.kind, 'startUsingKernelSpec');
                    const kernelSpec =
                        kernelConnection.kind !== 'connectToLiveKernel' ? kernelConnection.kernelSpec : undefined;
                    assert.equal(kernelSpec?.name, localKernel.name);
                } else {
                    assert.equal(kernelConnection.kind, 'connectToLiveKernel');
                    const kernelModel =
                        kernelConnection.kind === 'connectToLiveKernel' ? kernelConnection.kernelModel : undefined;
                    assert.equal(kernelModel?.name, remoteKernel.name);
                }
            }

            test('Register Command', () => {
                notebookCommands.register();

                verify(
                    commandManager.registerCommand(Commands.SwitchJupyterKernel, anything(), notebookCommands)
                ).once();
            });
            suite('Command Handler', () => {
                // tslint:disable-next-line: no-any
                let commandHandler: Function;
                setup(() => {
                    notebookCommands.register();
                    // tslint:disable-next-line: no-any
                    commandHandler = capture(commandManager.registerCommand as any).first()[1] as Function;
                    commandHandler = commandHandler.bind(notebookCommands);
                });
                test('Should not switch if no identity', async () => {
                    await commandHandler.bind(notebookCommands)();
                    verify(
                        kernelSelectionProvider.getKernelSelectionsForLocalSession(
                            anything(),
                            anything(),
                            anything(),
                            anything()
                        )
                    ).never();
                });
                test('Should switch kernel using the provided notebookxxx', async () => {
                    const notebook = createNotebookMock();
                    when((notebook as any).then).thenReturn(undefined);
                    const uri = Uri.file('test.ipynb');
                    when(notebookProvider.getOrCreateNotebook(anything())).thenCall(async () => {
                        return instance(notebook);
                    });

                    await commandHandler.bind(notebookCommands)({ identity: uri });

                    verifyCallToSetKernelSpec(notebook);
                });
                test('Should switch kernel using the active Native Editor', async () => {
                    const nativeEditor = createNotebookMock();
                    const uri = Uri.file('test.ipynb');
                    // tslint:disable-next-line: no-any
                    when(notebookEditorProvider.activeEditor).thenReturn({
                        file: uri,
                        model: { metadata: undefined }
                    } as any);
                    when(notebookProvider.getOrCreateNotebook(anything())).thenResolve(instance(nativeEditor));

                    await commandHandler.bind(notebookCommands)();

                    verifyCallToSetKernelSpec(nativeEditor);
                });
                test('Should switch kernel using the active Interactive Window', async () => {
                    const interactiveWindow = createNotebookMock();
                    const uri = Uri.parse('history://foobar');
                    // tslint:disable-next-line: no-any
                    when(interactiveWindowProvider.activeWindow).thenReturn({
                        identity: uri
                    } as any);
                    when(notebookProvider.getOrCreateNotebook(anything())).thenResolve(instance(interactiveWindow));

                    await commandHandler.bind(notebookCommands)();

                    verifyCallToSetKernelSpec(interactiveWindow);
                });
                test('Should switch kernel using the active Native editor even if an Interactive Window is available', async () => {
                    const uri1 = Uri.parse('history://foobar');
                    const nativeEditor = createNotebookMock();
                    const uri2 = Uri.parse('test.ipynb');
                    when(notebookEditorProvider.activeEditor).thenReturn({
                        file: uri2,
                        model: { metadata: undefined }
                    } as any);
                    when(interactiveWindowProvider.activeWindow).thenReturn({
                        identity: uri1
                    } as any);
                    when(notebookProvider.getOrCreateNotebook(anything())).thenCall(async (o) => {
                        if (o.identity === uri2) {
                            return instance(nativeEditor);
                        }
                    });

                    await commandHandler.bind(notebookCommands)();

                    verifyCallToSetKernelSpec(nativeEditor);
                });
                test('With no notebook, should still fire change', async () => {
                    when(notebookProvider.getOrCreateNotebook(anything())).thenResolve(undefined);
                    const uri = Uri.parse('history://foobar');
                    await commandHandler.bind(notebookCommands)({ identity: uri });
                    verify(notebookProvider.firePotentialKernelChanged(anything(), anything())).once();
                });
            });
        });
    });
});
