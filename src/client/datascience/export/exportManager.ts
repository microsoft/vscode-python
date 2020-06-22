import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { ProgressReporter } from '../progress/progressReporter';
import { IDataScienceErrorHandler, INotebookModel } from '../types';
import { IExportManagerFilePicker } from './exportManagerFilePicker';
import { ExportFormat, IExport, IExportManager } from './types';

@injectable()
export class ExportManager implements IExportManager {
    constructor(
        @inject(IExport) @named(ExportFormat.pdf) private readonly exportToPDF: IExport,
        @inject(IExport) @named(ExportFormat.html) private readonly exportToHTML: IExport,
        @inject(IExport) @named(ExportFormat.python) private readonly exportToPython: IExport,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler,
        @inject(IExportManagerFilePicker) private readonly filePicker: IExportManagerFilePicker,
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter
    ) {}

    public async export(format: ExportFormat, model: INotebookModel): Promise<Uri | undefined> {
        let target;
        if (format !== ExportFormat.python) {
            target = await this.filePicker.getExportFileLocation(format, model.file);
            if (!target) {
                return;
            }
        } else {
            target = Uri.file((await this.fileSystem.createTemporaryFile('.py')).filePath);
        }

        const name = path.basename(target.fsPath, path.extname(target.fsPath)).replace('_', ' ');
        const tempFile = await this.makeTemporaryFile(model, name);
        if (!tempFile) {
            return; // error making temp file
        }

        const reporter = this.progressReporter.createProgressIndicator(`Exporting to ${format}`);
        const source = Uri.file(tempFile.filePath);
        try {
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
            tempFile.dispose();
            reporter.dispose();
        }

        return target;
    }

    private async makeTemporaryFile(model: INotebookModel, name: string): Promise<TemporaryFile | undefined> {
        let tempFile: TemporaryFile | undefined;
        try {
            tempFile = await this.fileSystem.createTemporaryFile('.ipynb');
            let content = model ? model.getContent() : '';
            const jsonContent = JSON.parse(content);
            jsonContent.metadata.title = name;
            content = JSON.stringify(jsonContent);
            await this.fileSystem.writeFile(tempFile.filePath, content, 'utf-8');
        } catch (e) {
            await this.errorHandler.handleError(e);
        }

        return tempFile;
    }
}
