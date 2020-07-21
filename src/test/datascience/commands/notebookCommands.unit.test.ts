// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { NotebookCommands } from '../../../client/datascience/commands/notebookCommands';
import { Commands } from '../../../client/datascience/constants';
import { NotebookProvider } from '../../../client/datascience/interactive-common/notebookProvider';
import { NativeEditorProvider } from '../../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { InteractiveWindowProvider } from '../../../client/datascience/interactive-window/interactiveWindowProvider';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import { KernelSelector } from '../../../client/datascience/jupyter/kernels/kernelSelector';
import { KernelSwitcher } from '../../../client/datascience/jupyter/kernels/kernelSwitcher';
import { IInteractiveWindowProvider, INotebookEditorProvider } from '../../../client/datascience/types';

// tslint:disable: max-func-body-length
suite('Data Science - KernelSwitcher Command', () => {
    let notebookCommands: NotebookCommands;
    let commandManager: ICommandManager;
    let interactiveWindowProvider: IInteractiveWindowProvider;
    let notebookEditorProvider: INotebookEditorProvider;
    let kernelSwitcher: KernelSwitcher;
    let kernelSelector: KernelSelector;

    setup(() => {
        interactiveWindowProvider = mock(InteractiveWindowProvider);
        notebookEditorProvider = mock(NativeEditorProvider);
        const notebookProvider = mock(NotebookProvider);
        commandManager = mock(CommandManager);
        kernelSwitcher = mock(KernelSwitcher);
        kernelSelector = mock(KernelSelector);

        notebookCommands = new NotebookCommands(
            instance(commandManager),
            instance(notebookEditorProvider),
            instance(interactiveWindowProvider),
            instance(notebookProvider),
            instance(kernelSelector),
            instance(kernelSwitcher)
        );
    });

    test('Register Command', () => {
        notebookCommands.register();

        verify(commandManager.registerCommand(Commands.SwitchJupyterKernel, anything(), notebookCommands)).once();
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
        test('Should switch even if no active notebook', async () => {
            await commandHandler.bind(notebookCommands)();

            verify(kernelSwitcher.switchKernelWithRetry(anything(), anything())).once();
        });
        test('Should switch kernel using the provided notebook', async () => {
            const notebook = mock(JupyterNotebookBase);

            await commandHandler.bind(notebookCommands)(instance(notebook));

            verify(kernelSwitcher.switchKernelWithRetry(instance(notebook), anything())).once();
        });
        test('Should switch kernel using the active Native Editor', async () => {
            const nativeEditor = mock(JupyterNotebookBase);
            // tslint:disable-next-line: no-any
            when(notebookEditorProvider.activeEditor).thenReturn({ notebook: instance(nativeEditor) } as any);

            await commandHandler.bind(notebookCommands)();

            verify(kernelSwitcher.switchKernelWithRetry(instance(nativeEditor), anything())).once();
        });
        test('Should switch kernel using the active Interactive Window', async () => {
            const interactiveWindow = mock(JupyterNotebookBase);
            // tslint:disable-next-line: no-any
            when(interactiveWindowProvider.activeWindow).thenReturn({ notebook: instance(interactiveWindow) } as any);

            await commandHandler.bind(notebookCommands)();

            verify(kernelSwitcher.switchKernelWithRetry(instance(interactiveWindow), anything())).once();
        });
        test('Should switch kernel using the active Native editor even if an Interactive Window is available', async () => {
            const interactiveWindow = mock(JupyterNotebookBase);
            const nativeEditor = mock(JupyterNotebookBase);
            // tslint:disable-next-line: no-any
            when(notebookEditorProvider.activeEditor).thenReturn({ notebook: instance(nativeEditor) } as any);
            // tslint:disable-next-line: no-any
            when(interactiveWindowProvider.activeWindow).thenReturn({ notebook: instance(interactiveWindow) } as any);

            await commandHandler.bind(notebookCommands)();

            verify(kernelSwitcher.switchKernelWithRetry(instance(nativeEditor), anything())).once();
        });
    });
});
