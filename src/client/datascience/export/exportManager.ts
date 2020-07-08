import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { ProgressReporter } from '../progress/progressReporter';
import { INotebookModel } from '../types';
import { ExportUtil } from './exportUtil';
import { ExportFormat, IExport, IExportManager, IExportManagerFilePicker } from './types';

@injectable()
export class ExportManager implements IExportManager {
    constructor(
        @inject(IExport) @named(ExportFormat.pdf) private readonly exportToPDF: IExport,
        @inject(IExport) @named(ExportFormat.html) private readonly exportToHTML: IExport,
        @inject(IExport) @named(ExportFormat.python) private readonly exportToPython: IExport,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IExportManagerFilePicker) private readonly filePicker: IExportManagerFilePicker,
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter,
        @inject(ExportUtil) private readonly exportUtil: ExportUtil
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

        // Need to make a temp directory here, instead of just a temp file. This is because
        // we need to store the contents of the notebook in a file that is named the same
        // as what we want the title of the exported file to be. To ensure this file path will be unique
        // we store it in a temp directory. The name of the file matters because when
        // exporting to certain formats the filename is used within the exported document as the title.
        const fileName = path.basename(target.fsPath, path.extname(target.fsPath));
        const tempDir = await this.exportUtil.generateTempDir();
        const sourceFilePath = await this.exportUtil.makeFileInDirectory(model, fileName, tempDir.path);
        const source = Uri.file(sourceFilePath);

        if (format === ExportFormat.pdf) {
            // When exporting to PDF we need to remove any SVG output. This is due to an error
            // with nbconvert and a dependency of its called InkScape.
            await this.exportUtil.removeSvgs(source);
        }

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
            tempDir.dispose();
        }

        return target;
    }
}
