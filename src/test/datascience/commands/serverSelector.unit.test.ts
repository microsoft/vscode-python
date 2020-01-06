// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { anything, capture, instance, mock, verify } from 'ts-mockito';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { JupyterServerSelectorCommand } from '../../../client/datascience/commands/serverSelector';
import { Commands } from '../../../client/datascience/constants';
import { JupyterServerSelector } from '../../../client/datascience/jupyter/serverSelector';

// tslint:disable: max-func-body-length
suite('Data Science - Server Selector Command', () => {
    let serverSelectorCommand: JupyterServerSelectorCommand;
    let commandManager: ICommandManager;
    let serverSelector: JupyterServerSelector;

    setup(() => {
        commandManager = mock(CommandManager);
        serverSelector = mock(JupyterServerSelector);

        serverSelectorCommand = new JupyterServerSelectorCommand(instance(commandManager), instance(serverSelector));
    });

    test('Register Command', () => {
        serverSelectorCommand.register();

        verify(commandManager.registerCommand(Commands.SelectJupyterURI, anything(), instance(serverSelector))).once();
    });

    test('Command Handler should invoke ServerSelector', () => {
        serverSelectorCommand.register();
        // tslint:disable-next-line: no-any
        const handler = (capture(commandManager.registerCommand as any).first()[1] as Function).bind(serverSelectorCommand);

        handler();

        verify(serverSelector.selectJupyterURI()).once();
    });
});
