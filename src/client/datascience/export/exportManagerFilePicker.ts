import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { Memento, SaveDialogOptions, Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { ExportNotebookSettings } from '../interactive-common/interactiveWindowTypes';
import { ExportFormat } from './exportManager';

export const PDFExtensions = { PDF: ['pdf'] };
export const HTMLExtensions = { HTML: ['html', 'htm'] };
export const PythonExtensions = { Python: ['py'] };

export const IExportManagerFilePicker = Symbol('IExportManagerFilePicker');
export interface IExportManagerFilePicker {
    getExportFileLocation(format: ExportFormat, source: Uri): Promise<Uri | undefined>;
}

@injectable()
export class ExportManagerFilePicker implements IExportManagerFilePicker {
    private readonly defaultExportSaveLocation = ''; // set default save location

    constructor(
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceStorage: Memento
    ) {}

    public async getExportFileLocation(format: ExportFormat, source: Uri): Promise<Uri | undefined> {
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

        const notebookFileName = path.basename(source.fsPath);
        const dialogUri = Uri.file(path.join(this.getLastFileSaveLocation().fsPath, notebookFileName));
        const options: SaveDialogOptions = {
            defaultUri: dialogUri,
            saveLabel: 'Export',
            filters: fileExtensions
        };

        const uri = await this.applicationShell.showSaveDialog(options);
        if (uri) {
            this.updateFileSaveLocation(uri);
        }
        return uri;
    }

    private getLastFileSaveLocation(): Uri {
        const filePath = this.workspaceStorage.get(
            ExportNotebookSettings.lastSaveLocation,
            this.defaultExportSaveLocation
        );

        return Uri.file(filePath);
    }

    private updateFileSaveLocation(value: Uri) {
        const filePath = value.fsPath;
        // use path module
        this.workspaceStorage.update(ExportNotebookSettings.lastSaveLocation, filePath);
    }
}
