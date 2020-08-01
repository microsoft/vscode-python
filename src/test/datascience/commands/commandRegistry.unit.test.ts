// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { anything, instance, mock, verify } from 'ts-mockito';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { DebugService } from '../../../client/common/application/debugService';
import { DocumentManager } from '../../../client/common/application/documentManager';
import { ICommandManager } from '../../../client/common/application/types';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { StartPage } from '../../../client/common/startPage/startPage';
import { JupyterCommandLineSelectorCommand } from '../../../client/datascience/commands/commandLineSelector';
import { CommandRegistry } from '../../../client/datascience/commands/commandRegistry';
import { ExportCommands } from '../../../client/datascience/commands/exportCommands';
import { NotebookCommands } from '../../../client/datascience/commands/notebookCommands';
import { JupyterServerSelectorCommand } from '../../../client/datascience/commands/serverSelector';
import { Commands } from '../../../client/datascience/constants';
import { DataScienceFileSystem } from '../../../client/datascience/dataScienceFileSystem';
import { DataScienceCodeLensProvider } from '../../../client/datascience/editor-integration/codelensprovider';
import { NativeEditorProvider } from '../../../client/datascience/notebookStorage/nativeEditorProvider';
import { MockOutputChannel } from '../../mockClasses';

// tslint:disable: max-func-body-length
suite('DataScience - Commands', () => {
    let kernelSwitcherCommand: NotebookCommands;
    let serverSelectorCommand: JupyterServerSelectorCommand;
    let commandLineCommand: JupyterCommandLineSelectorCommand;
    let commandRegistry: CommandRegistry;
    let commandManager: ICommandManager;
    setup(() => {
        kernelSwitcherCommand = mock(NotebookCommands);
        serverSelectorCommand = mock(JupyterServerSelectorCommand);
        commandLineCommand = mock(JupyterCommandLineSelectorCommand);

        const codeLensProvider = mock(DataScienceCodeLensProvider);
        const notebookEditorProvider = mock(NativeEditorProvider);
        const debugService = mock(DebugService);
        const documentManager = mock(DocumentManager);
        commandManager = mock(CommandManager);
        const configService = mock(ConfigurationService);
        const appShell = mock(ApplicationShell);
        const startPage = mock(StartPage);
        const exportCommand = mock(ExportCommands);
        const fileSystem = mock(DataScienceFileSystem);

        commandRegistry = new CommandRegistry(
            documentManager,
            instance(codeLensProvider),
            [],
            instance(commandManager),
            instance(serverSelectorCommand),
            instance(kernelSwitcherCommand),
            instance(commandLineCommand),
            instance(notebookEditorProvider),
            instance(debugService),
            instance(configService),
            instance(appShell),
            new MockOutputChannel('Jupyter'),
            instance(startPage),
            instance(exportCommand),
            instance(fileSystem)
        );
    });

    suite('Register', () => {
        setup(() => {
            commandRegistry.register();
        });

        test('Should register server Selector Command', () => {
            verify(serverSelectorCommand.register()).once();
        });
        test('Should register server kernelSwitcher Command', () => {
            verify(kernelSwitcherCommand.register()).once();
        });
        [
            Commands.RunAllCells,
            Commands.RunCell,
            Commands.RunCurrentCell,
            Commands.RunCurrentCellAdvance,
            Commands.ExecSelectionInInteractiveWindow,
            Commands.RunAllCellsAbove,
            Commands.RunCellAndAllBelow,
            Commands.RunAllCellsAbovePalette,
            Commands.RunCellAndAllBelowPalette,
            Commands.RunToLine,
            Commands.RunFromLine,
            Commands.RunFileInInteractiveWindows,
            Commands.DebugFileInInteractiveWindows,
            Commands.AddCellBelow,
            Commands.RunCurrentCellAndAddBelow,
            Commands.DebugCell,
            Commands.DebugStepOver,
            Commands.DebugContinue,
            Commands.DebugStop,
            Commands.DebugCurrentCellPalette,
            Commands.CreateNewNotebook,
            Commands.ViewJupyterOutput
        ].forEach((command) => {
            test(`Should register Command ${command}`, () => {
                // tslint:disable-next-line: no-any
                verify(commandManager.registerCommand(command as any, anything(), commandRegistry)).once();
            });
        });
    });
});
