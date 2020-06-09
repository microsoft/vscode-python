import { inject, injectable, named } from 'inversify';
import { Memento, QuickPickItem, QuickPickOptions, SaveDialogOptions, Uri } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { Commands } from '../constants';
import { ExportNotebookSettings } from '../interactive-common/interactiveWindowTypes';
import { IDataScienceErrorHandler, INotebookEditorProvider } from '../types';

export enum ExportFormat {
    pdf = 'pdf',
    html = 'html',
    python = 'python'
}

export const PDFExtensions = { PDF: ['.pdf'] };
export const HTMLExtensions = { HTML: ['.html', 'htm'] };
export const PythonExtensions = { Python: ['.py'] };

export const IExportManager = Symbol('IExportManager');
export interface IExportManager {
    export(format?: ExportFormat): Promise<void>;
}

export const IExport = Symbol('IExport');
export interface IExport {
    export(source: Uri, target?: Uri): Promise<void>;
}

interface IExportQuickPickItem extends QuickPickItem {
    handler(): void;
}

@injectable()
export class ExportManager implements IExportManager {
    private readonly defaultExportSaveLocation = ''; // set default save location

    constructor(
        @inject(IExport) @named(ExportFormat.pdf) private readonly exportToPDF: IExport,
        @inject(IExport) @named(ExportFormat.html) private readonly exportToHTML: IExport,
        @inject(IExport) @named(ExportFormat.python) private readonly exportToPython: IExport,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceStorage: Memento,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler
    ) {}

    public async export(format?: ExportFormat) {
        // need to add telementry and status messages
        const activeEditor = this.notebookEditorProvider.activeEditor;
        if (!activeEditor) {
            return;
        }
        if (!format) {
            const pickedItem = await this.showExportQuickPickMenu().then((item) => item);
            if (pickedItem !== undefined) {
                pickedItem.handler();
            }
            return;
        }

        let target;
        if (format !== ExportFormat.python) {
            target = await this.getExportFileLocation(format);
            if (!target) {
                return; // user didn't select path
            }
        }

        const tempFile = await this.makeTemporaryFile();
        if (!tempFile) {
            return; // error making temp file
        }

        try {
            const source = Uri.file(tempFile.filePath);

            switch (format) {
                case ExportFormat.python:
                    await this.exportToPython.export(source, target);
                    break;

                case ExportFormat.pdf:
                    await this.exportToPDF.export(source, target);
                    break;

                case ExportFormat.html:
                    await this.exportToHTML.export(source, target);
                    break;
                default:
                    break;
            }
        } finally {
            tempFile.dispose(); // need to dispose of temp file
        }
    }

    private async makeTemporaryFile(): Promise<TemporaryFile | undefined> {
        let tempFile: TemporaryFile | undefined;
        try {
            tempFile = await this.fileSystem.createTemporaryFile('.ipynb');
            const activeEditor = this.notebookEditorProvider.activeEditor;
            const content = activeEditor?.model ? activeEditor.model.getContent() : '';
            await this.fileSystem.writeFile(tempFile.filePath, content, 'utf-8');
        } catch (e) {
            await this.errorHandler.handleError(e);
        }

        return tempFile;
    }

    private getExportQuickPickItems(): IExportQuickPickItem[] {
        return [
            {
                label: 'Python Script',
                picked: true,
                handler: () => this.commandManager.executeCommand(Commands.ExportAsPythonScript)
            }
            //{ label: 'HTML', picked: false, handler: () => this.commandManager.executeCommand(Commands.ExportToHTML) },
            //{ label: 'PDF', picked: false, handler: () => this.commandManager.executeCommand(Commands.ExportToPDF) }
        ];
    }

    private async showExportQuickPickMenu(): Promise<IExportQuickPickItem | undefined> {
        const items = this.getExportQuickPickItems();

        const options: QuickPickOptions = {
            ignoreFocusOut: false,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Export As...'
        };

        return this.applicationShell.showQuickPick(items, options);
    }

    private getFileSaveLocation(): Uri {
        const filePath = this.workspaceStorage.get(
            ExportNotebookSettings.lastSaveLocation,
            this.defaultExportSaveLocation
        );

        return Uri.file(filePath);
    }

    private updateFileSaveLocation(value: Uri) {
        const filePath = value.toString();
        this.workspaceStorage.update(ExportNotebookSettings.lastSaveLocation, filePath);
    }

    private async getExportFileLocation(format: ExportFormat): Promise<Uri | undefined> {
        let fileExtensions;
        switch (format) {
            case ExportFormat.python:
                fileExtensions = PythonExtensions;
                break;

            case ExportFormat.pdf:
                fileExtensions = PDFExtensions;
                break;

            case ExportFormat.html:
                fileExtensions = HTMLExtensions;
                break;

            default:
                return;
        }

        const options: SaveDialogOptions = {
            defaultUri: this.getFileSaveLocation(),
            saveLabel: '',
            filters: fileExtensions
        };

        const uri = await this.applicationShell.showSaveDialog(options);
        if (uri) {
            this.updateFileSaveLocation(uri);
        }
        return uri;
    }
}
