import { inject, injectable, named } from 'inversify';
import { CancellationToken } from 'monaco-editor';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { TemporaryDirectory } from '../../common/platform/types';
import * as localize from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { ProgressReporter } from '../progress/progressReporter';
import { IDataScienceFileSystem, INotebookModel } from '../types';
import { ExportDependencyChecker } from './exportDependencyChecker';
import { ExportFileOpener } from './exportFileOpener';
import { ExportUtil } from './exportUtil';
import { ExportFormat, IExport, IExportManager, IExportManagerFilePicker } from './types';

@injectable()
export class ExportManager implements IExportManager {
    constructor(
        @inject(IExport) @named(ExportFormat.pdf) private readonly exportToPDF: IExport,
        @inject(IExport) @named(ExportFormat.html) private readonly exportToHTML: IExport,
        @inject(IExport) @named(ExportFormat.python) private readonly exportToPython: IExport,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem,
        @inject(IExportManagerFilePicker) private readonly filePicker: IExportManagerFilePicker,
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter,
        @inject(ExportUtil) private readonly exportUtil: ExportUtil,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(ExportFileOpener) private readonly exportFileOpener: ExportFileOpener,
        @inject(ExportDependencyChecker) private exportDepedencyChecker: ExportDependencyChecker
    ) {}

    public async export(format: ExportFormat, model: INotebookModel, defaultFileName?: string): Promise<undefined> {
        let target;
        try {
            await this.exportDepedencyChecker.checkDependencies(format);
            target = await this.getTargetFile(format, model, defaultFileName);
            if (!target) {
                return;
            }
            await this.performExport(format, model, target);
        } catch (e) {
            traceError('Export failed', e);
            sendTelemetryEvent(Telemetry.ExportNotebookAsFailed, undefined, { format: format });

            if (format === ExportFormat.pdf) {
                traceError(localize.DataScience.exportToPDFDependencyMessage());
            }

            this.showExportFailed(localize.DataScience.exportFailedGeneralMessage());
        }
    }

    private async performExport(format: ExportFormat, model: INotebookModel, target: Uri) {
        /* Need to make a temp directory here, instead of just a temp file. This is because
           we need to store the contents of the notebook in a file that is named the same
           as what we want the title of the exported file to be. To ensure this file path will be unique
           we store it in a temp directory. The name of the file matters because when
           exporting to certain formats the filename is used within the exported document as the title. */
        const tempDir = await this.exportUtil.generateTempDir();
        const source = await this.makeSourceFile(target, model, tempDir);

        const reporter = this.progressReporter.createProgressIndicator(`Exporting to ${format}`, true);
        try {
            await this.exportToFormat(source, target, format, reporter.token);
        } finally {
            tempDir.dispose();
            reporter.dispose();
        }

        if (reporter.token.isCancellationRequested) {
            sendTelemetryEvent(Telemetry.ExportNotebookAs, undefined, { format: format, cancelled: true });
            return;
        }
        await this.exportFileOpener.openFile(format, target);
    }

    private async getTargetFile(
        format: ExportFormat,
        model: INotebookModel,
        defaultFileName?: string
    ): Promise<Uri | undefined> {
        let target;

        if (format !== ExportFormat.python) {
            target = await this.filePicker.getExportFileLocation(format, model.file, defaultFileName);
        } else {
            target = Uri.file((await this.fs.createTemporaryLocalFile('.py')).filePath);
        }

        return target;
    }

    private async makeSourceFile(target: Uri, model: INotebookModel, tempDir: TemporaryDirectory): Promise<Uri> {
        // Creates a temporary file with the same base name as the target file
        const fileName = path.basename(target.fsPath, path.extname(target.fsPath));
        const sourceFilePath = await this.exportUtil.makeFileInDirectory(model, `${fileName}.ipynb`, tempDir.path);
        return Uri.file(sourceFilePath);
    }

    private showExportFailed(msg: string) {
        // tslint:disable-next-line: messages-must-be-localized
        this.applicationShell.showErrorMessage(`${localize.DataScience.failedExportMessage()} ${msg}`).then();
    }

    private async exportToFormat(source: Uri, target: Uri, format: ExportFormat, cancelToken: CancellationToken) {
        if (format === ExportFormat.pdf) {
            // When exporting to PDF we need to remove any SVG output. This is due to an error
            // with nbconvert and a dependency of its called InkScape.
            await this.exportUtil.removeSvgs(source);
        }

        switch (format) {
            case ExportFormat.python:
                await this.exportToPython.export(source, target, cancelToken);
                break;

            case ExportFormat.pdf:
                await this.exportToPDF.export(source, target, cancelToken);
                break;

            case ExportFormat.html:
                await this.exportToHTML.export(source, target, cancelToken);
                break;

            default:
                break;
        }
    }
}
