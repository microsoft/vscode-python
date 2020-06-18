import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { getLocString } from '../../../datascience-ui/react-common/locReactSide';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { IBrowserService } from '../../common/types';
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
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IBrowserService) private readonly browserService: IBrowserService
    ) {}

    public async export(format: ExportFormat, model: INotebookModel): Promise<Uri | undefined> {
        const reporter = this.progressReporter.createProgressIndicator(`Exporting to ${format}`); // need to localize
        let uri: Uri | undefined;
        try {
            uri = await this.manager.export(format, model);
        } catch (e) {
            await this.showExportFailed(e);
        } finally {
            reporter.dispose();
        }

        if (uri) {
            if (format === ExportFormat.python) {
                await this.openPythonFile(uri);
            } else {
                await this.askOpenFile(uri);
            }
        }
        return;
    }

    private async openPythonFile(uri: Uri): Promise<void> {
        const contents = await this.fileSystem.readFile(uri.fsPath);
        await this.fileSystem.deleteFile(uri.fsPath);
        const doc = await this.documentManager.openTextDocument({ language: PYTHON_LANGUAGE, content: contents });
        await this.documentManager.showTextDocument(doc);
    }

    private async showExportFailed(msg: string) {
        await this.applicationShell.showErrorMessage(
            // tslint:disable-next-line: messages-must-be-localized
            `${getLocString('DataScience.failedExportMessage', 'Export failed')} ${msg}`
        );
    }

    private async askOpenFile(uri: Uri): Promise<void> {
        const yes = getLocString('DataScience.openExportFileYes', 'Yes');
        const no = getLocString('DataScience.openExportFileNo', 'No');
        const items = [yes, no];

        const selected = await this.applicationShell
            .showInformationMessage(
                getLocString('DataScience.openExportedFileMessage', 'Would you like to open the exported file?'),
                ...items
            )
            .then((item) => item);

        if (selected === yes) {
            this.browserService.launch(uri.toString());
        }
    }
}
