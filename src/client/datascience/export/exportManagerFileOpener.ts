import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IDocumentManager } from '../../common/application/types';
import { ProgressReporter } from '../progress/progressReporter';
import { INotebookModel } from '../types';
import { ExportFormat, IExportManager } from './exportManager';
import { ExportManagerDependencyChecker } from './exportManagerDependencyChecker';

@injectable()
export class ExportManagerFileOpener implements IExportManager {
    constructor(
        @inject(ExportManagerDependencyChecker) private readonly manager: IExportManager,
        @inject(IDocumentManager) protected readonly documentManager: IDocumentManager,
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter
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
        // maybe prompt before exporting
        if (format === ExportFormat.python) {
            await this.openPythonFile(uri);
        } else {
            throw new Error('Not supported');
        }
    }

    private async openPythonFile(uri: Uri): Promise<void> {
        const doc = await this.documentManager.openTextDocument(uri);
        await this.documentManager.showTextDocument(doc);
    }
}
