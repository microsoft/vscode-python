import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Commands } from '../../../../client/common/constants';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { CreatePythonFileCommandHandler } from '../../../../client/common/application/commands/createFileCommand';
import { ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { MockWorkspaceConfiguration } from '../../../mocks/mockWorkspaceConfig';

suite('Create New Python File Commmand', () => {
    let createNewFileCommandHandler: CreatePythonFileCommandHandler;
    let cmdManager: ICommandManager;
    let workspaceService: IWorkspaceService;

    setup(async () => {
        cmdManager = mock(CommandManager);

        createNewFileCommandHandler = new CreatePythonFileCommandHandler(instance(cmdManager));
        when(cmdManager.executeCommand(anything())).thenResolve();
        when(workspaceService.getConfiguration('python')).thenReturn(
            new MockWorkspaceConfiguration({
                createNewFileEnabled: true,
            }),
        );
        await createNewFileCommandHandler.activate();
    });

    test('Create a Python file if command is executed', async () => {
        await createNewFileCommandHandler.createPythonFile();

        verify(cmdManager.registerCommand(Commands.CreateNewFile, anything())).once();
        verify(cmdManager.executeCommand('python.createNewFile')).once();
    });
});
