import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { ProgressReporter } from '../progress/progressReporter';
import { IDataScienceErrorHandler, INotebookModel } from '../types';
import { ExportFormat, IExport, IExportManager, IExportManagerFilePicker, IExportUtil } from './types';

@injectable()
export class ExportManager implements IExportManager {
    constructor(
        @inject(IExport) @named(ExportFormat.pdf) private readonly exportToPDF: IExport,
        @inject(IExport) @named(ExportFormat.html) private readonly exportToHTML: IExport,
        @inject(IExport) @named(ExportFormat.python) private readonly exportToPython: IExport,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler,
        @inject(IExportManagerFilePicker) private readonly filePicker: IExportManagerFilePicker,
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter,
        @inject(IExportUtil) private readonly exportUtil: IExportUtil
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

        const fileName = path.basename(target.fsPath, path.extname(target.fsPath));
        const tempFilePath = await this.makeTemporaryFile(model, fileName);
        const source = Uri.file(tempFilePath);

        const reporter = this.progressReporter.createProgressIndicator(`Exporting to ${format}`);
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
            reporter.dispose();
            this.exportUtil.deleteDirectory(path.dirname(tempFilePath)).then().catch();
        }

        return target;
    }

    private async makeTemporaryFile(model: INotebookModel, name: string): Promise<string> {
        const tempFile = await this.fileSystem.createTemporaryFile('.ipynb');
        const directoryPath = path.join(
            path.dirname(tempFile.filePath),
            path.basename(tempFile.filePath, path.extname(tempFile.filePath))
        );
        const newFilePath = path.join(directoryPath, name);
        tempFile.dispose();

        try {
            await this.fileSystem.createDirectory(directoryPath);
            const content = model ? model.getContent() : '';
            await this.fileSystem.writeFile(newFilePath, content, 'utf-8');
        } catch (e) {
            await this.errorHandler.handleError(e);
        }

        return newFilePath;
    }
}
