import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IDataScienceErrorHandler, INotebookEditor } from '../types';
import { IExportManagerFilePicker } from './exportManagerFilePicker';

export enum ExportFormat {
    pdf = 'pdf',
    html = 'html',
    python = 'python'
}

export const IExportManager = Symbol('IExportManager');
export interface IExportManager {
    export(format: ExportFormat, activeEditor: INotebookEditor): Promise<Uri | undefined>;
}

export const IExport = Symbol('IExport');
export interface IExport {
    export(source: Uri, target?: Uri): Promise<void>;
}

@injectable()
export class ExportManager implements IExportManager {
    constructor(
        @inject(IExport) @named(ExportFormat.pdf) private readonly exportToPDF: IExport,
        @inject(IExport) @named(ExportFormat.html) private readonly exportToHTML: IExport,
        @inject(IExport) @named(ExportFormat.python) private readonly exportToPython: IExport,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler,
        @inject(IExportManagerFilePicker) private readonly filePicker: IExportManagerFilePicker
    ) {}

    public async export(format: ExportFormat, activeEditor: INotebookEditor): Promise<Uri | undefined> {
        // need to add telementry and status messages

        const target = await this.filePicker.getExportFileLocation(format);
        if (!target) {
            return;
        }

        const tempFile = await this.makeTemporaryFile(activeEditor);
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

    private async makeTemporaryFile(activeEditor: INotebookEditor): Promise<TemporaryFile | undefined> {
        let tempFile: TemporaryFile | undefined;
        try {
            tempFile = await this.fileSystem.createTemporaryFile('.ipynb');
            const content = activeEditor?.model ? activeEditor.model.getContent() : '';
            await this.fileSystem.writeFile(tempFile.filePath, content, 'utf-8');
        } catch (e) {
            await this.errorHandler.handleError(e);
        }

        return tempFile;
    }
}

// continue with decorater pattern - READ
// ts mockito - READ
// test that stuff
