import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { ProgressReporter } from '../progress/progressReporter';
import { INotebookModel } from '../types';
import { ExportManagerDependencyChecker } from './exportManagerDependencyChecker';
import { ExportFormat, IExportManager } from './types';

@injectable()
export class ExportManagerFileOpener implements IExportManager {
    constructor(
        @inject(ExportManagerDependencyChecker) private readonly manager: IExportManager,
        @inject(IDocumentManager) protected readonly documentManager: IDocumentManager,
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem
    ) {}

    public async export(format: ExportFormat, model: INotebookModel): Promise<Uri | undefined> {
        const reporter = this.progressReporter.createProgressIndicator(`Exporting to ${format}`); // need to localize
        let uri: Uri | undefined;
        try {
            uri = await this.manager.export(format, model);
            if (!uri) {
                return;
            }
        } finally {
            reporter.dispose();
        }

        if (format === ExportFormat.python) {
            await this.openPythonFile(uri);
        } else {
            throw new Error('Not supported');
        }
    }

    private async openPythonFile(uri: Uri): Promise<void> {
        const contents = await this.fileSystem.readFile(uri.fsPath);
        await this.fileSystem.deleteFile(uri.fsPath);
        const doc = await this.documentManager.openTextDocument({ language: PYTHON_LANGUAGE, content: contents });
        await this.documentManager.showTextDocument(doc);
    }
}
