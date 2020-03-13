// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { KernelSwitcherCommand } from '../../../client/datascience/commands/kernelSwitcher';
import { Commands } from '../../../client/datascience/constants';
import { NativeEditorProvider } from '../../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { InteractiveWindowProvider } from '../../../client/datascience/interactive-window/interactiveWindowProvider';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import { KernelSwitcher } from '../../../client/datascience/jupyter/kernels/kernelSwitcher';
import { IInteractiveWindowProvider, INotebookEditorProvider } from '../../../client/datascience/types';

// tslint:disable: max-func-body-length
suite('Data Science - KernelSwitcher Command', () => {
    let kernelSwitcherCommand: KernelSwitcherCommand;
    let commandManager: ICommandManager;
    let interactiveWindowProvider: IInteractiveWindowProvider;
    let notebookEditorProvider: INotebookEditorProvider;
    let kernelSwitcher: KernelSwitcher;

    setup(() => {
        interactiveWindowProvider = mock(InteractiveWindowProvider);
        notebookEditorProvider = mock(NativeEditorProvider);
        commandManager = mock(CommandManager);
        kernelSwitcher = mock(KernelSwitcher);

        kernelSwitcherCommand = new KernelSwitcherCommand(
            instance(commandManager),
            instance(kernelSwitcher),
            instance(notebookEditorProvider),
            instance(interactiveWindowProvider)
        );
    });

    test('Register Command', () => {
        kernelSwitcherCommand.register();

        verify(commandManager.registerCommand(Commands.SwitchJupyterKernel, anything(), kernelSwitcherCommand)).once();
    });
    suite('Command Handler', () => {
        // tslint:disable-next-line: no-any
        let commandHandler: Function;
        setup(() => {
            kernelSwitcherCommand.register();
            // tslint:disable-next-line: no-any
            commandHandler = capture(commandManager.registerCommand as any).first()[1] as Function;
            commandHandler = commandHandler.bind(kernelSwitcherCommand);
        });
        test('Should do nothing if there is no active notebook and no interactive window', async () => {
            await commandHandler.bind(kernelSwitcherCommand)();

            verify(kernelSwitcher.switchKernel(anything())).never();
        });
        test('Should switch kernel using the provided notebook', async () => {
            const notebook = mock(JupyterNotebookBase);

            await commandHandler.bind(kernelSwitcherCommand)(instance(notebook));

            verify(kernelSwitcher.switchKernel(instance(notebook))).once();
        });
        test('Should switch kernel using the active Native Editor', async () => {
            const nativeEditor = mock(JupyterNotebookBase);
            // tslint:disable-next-line: no-any
            when(notebookEditorProvider.activeEditor).thenReturn({ notebook: instance(nativeEditor) } as any);

            await commandHandler.bind(kernelSwitcherCommand)();

            verify(kernelSwitcher.switchKernel(instance(nativeEditor))).once();
        });
        test('Should switch kernel using the active Interactive Window', async () => {
            const interactiveWindow = mock(JupyterNotebookBase);
            // tslint:disable-next-line: no-any
            when(interactiveWindowProvider.getActive()).thenReturn({ notebook: instance(interactiveWindow) } as any);

            await commandHandler.bind(kernelSwitcherCommand)();

            verify(kernelSwitcher.switchKernel(instance(interactiveWindow))).once();
        });
        test('Should switch kernel using the active Native editor even if an Interactive Window is available', async () => {
            const interactiveWindow = mock(JupyterNotebookBase);
            const nativeEditor = mock(JupyterNotebookBase);
            // tslint:disable-next-line: no-any
            when(notebookEditorProvider.activeEditor).thenReturn({ notebook: instance(nativeEditor) } as any);
            // tslint:disable-next-line: no-any
            when(interactiveWindowProvider.getActive()).thenReturn({ notebook: instance(interactiveWindow) } as any);

            await commandHandler.bind(kernelSwitcherCommand)();

            verify(kernelSwitcher.switchKernel(instance(nativeEditor))).once();
        });
    });
});
