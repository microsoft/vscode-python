import { anything, instance, mock, verify } from 'ts-mockito';
import { Commands } from '../../../../client/common/constants';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { CreatePythonFileCommandHandler } from '../../../../client/common/application/commands/createFileCommand';
import { ICommandManager } from '../../../../client/common/application/types';

suite('Create New Python File Commmand', () => {
    let createNewFileCommandHandler: CreatePythonFileCommandHandler;
    let cmdManager: ICommandManager;

    setup(async () => {
        cmdManager = mock(CommandManager);
        createNewFileCommandHandler = new CreatePythonFileCommandHandler(instance(cmdManager));
        await createNewFileCommandHandler.activate();
    });

    test('Create a Python file if command is executed', async () => {
        await createNewFileCommandHandler.createPythonFile();

        verify(cmdManager.registerCommand(Commands.CreateNewFile, anything())).once();
        verify(cmdManager.executeCommand('python.createNewFile')).once();
    });
});
