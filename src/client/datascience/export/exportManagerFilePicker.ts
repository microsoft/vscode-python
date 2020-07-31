import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { Memento, SaveDialogOptions, Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { ExportNotebookSettings } from '../interactive-common/interactiveWindowTypes';
import { ExportFormat, IExportManagerFilePicker } from './types';

// File extensions for each export method
export const PDFExtensions = { PDF: ['pdf'] };
export const HTMLExtensions = { HTML: ['html', 'htm'] };
export const PythonExtensions = { Python: ['py'] };

@injectable()
export class ExportManagerFilePicker implements IExportManagerFilePicker {
    private readonly defaultExportSaveLocation = ''; // set default save location

    constructor(
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private workspaceStorage: Memento
    ) {}

    public async getExportFileLocation(
        format: ExportFormat,
        source: Uri,
        defaultFileName?: string
    ): Promise<Uri | undefined> {
        // map each export method to a set of file extensions
        let fileExtensions;
        let extension: string | undefined;
        switch (format) {
            case ExportFormat.python:
                fileExtensions = PythonExtensions;
                extension = '.py';
                break;

            case ExportFormat.pdf:
                extension = '.pdf';
                fileExtensions = PDFExtensions;
                break;

            case ExportFormat.html:
                extension = '.html';
                fileExtensions = HTMLExtensions;
                break;

            default:
                return;
        }

        const targetFileName = defaultFileName
            ? defaultFileName
            : `${path.basename(source.fsPath, path.extname(source.fsPath))}${extension}`;

        const dialogUri = Uri.file(path.join(this.getLastFileSaveLocation().fsPath, targetFileName));
        const options: SaveDialogOptions = {
            defaultUri: dialogUri,
            saveLabel: 'Export',
            filters: fileExtensions
        };

        const uri = await this.applicationShell.showSaveDialog(options);
        if (uri) {
            await this.updateFileSaveLocation(uri);
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

    private async updateFileSaveLocation(value: Uri) {
        const location = path.dirname(value.fsPath);
        await this.workspaceStorage.update(ExportNotebookSettings.lastSaveLocation, location);
    }
}
