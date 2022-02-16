import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Commands } from '../../../../client/common/constants';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { CreatePythonFileCommandHandler } from '../../../../client/common/application/commands/createFileCommand';
import { ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { MockWorkspaceConfiguration } from '../../../mocks/mockWorkspaceConfig';
import { WorkspaceService } from '../../../../client/common/application/workspace';

suite('Create New Python File Commmand', () => {
    let createNewFileCommandHandler: CreatePythonFileCommandHandler;
    let cmdManager: ICommandManager;
    let workspaceService: IWorkspaceService;

    setup(async () => {
        cmdManager = mock(CommandManager);
        workspaceService = mock(WorkspaceService);

        createNewFileCommandHandler = new CreatePythonFileCommandHandler(
            instance(cmdManager),
            instance(workspaceService),
        );
        when(cmdManager.executeCommand(anything())).thenResolve();
        when(workspaceService.getConfiguration('python')).thenReturn(
            new MockWorkspaceConfiguration({
                createNewFileEnabled: true,
            }),
        );
        await createNewFileCommandHandler.activate();
    });

    test('Create Python file command is registered', async () => {
        verify(cmdManager.registerCommand(Commands.CreateNewFile, anything())).once();
    });
    test('Create a Python file if command is executed', async () => {
        await createNewFileCommandHandler.createPythonFile();
        verify(cmdManager.executeCommand('python.createNewFile')).once();
    });
});
