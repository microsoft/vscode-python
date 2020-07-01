import { inject, injectable } from 'inversify';
import { Position, Uri } from 'vscode';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IBrowserService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { INotebookModel } from '../types';
import { ExportManagerDependencyChecker } from './exportManagerDependencyChecker';
import { ExportFormat, IExportManager } from './types';

@injectable()
export class ExportManagerFileOpener implements IExportManager {
    constructor(
        @inject(ExportManagerDependencyChecker) private readonly manager: IExportManager,
        @inject(IDocumentManager) protected readonly documentManager: IDocumentManager,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IBrowserService) private readonly browserService: IBrowserService
    ) {}

    public async export(format: ExportFormat, model: INotebookModel): Promise<Uri | undefined> {
        let uri: Uri | undefined;
        try {
            uri = await this.manager.export(format, model);
        } catch (e) {
            let msg = e;
            traceError('Export failed', e);
            sendTelemetryEvent(Telemetry.ExportNotebookAsFailed, undefined, { format: format });

            if (format === ExportFormat.pdf) {
                msg = localize.DataScience.exportToPDFDependencyMessage();
            }

            this.showExportFailed(msg);
            return;
        }

        if (!uri) {
            // if export didn't fail but no uri returned then user cancelled operation
            sendTelemetryEvent(Telemetry.ExportNotebookAs, undefined, { format: format, cancelled: true });
            return;
        }

        if (format === ExportFormat.python) {
            await this.openPythonFile(uri);
            sendTelemetryEvent(Telemetry.ExportNotebookAs, undefined, {
                format: format,
                successful: true,
                opened: true
            });
        } else {
            const opened = await this.askOpenFile(uri);
            sendTelemetryEvent(Telemetry.ExportNotebookAs, undefined, {
                format: format,
                successful: true,
                opened: opened
            });
        }
    }

    private async openPythonFile(uri: Uri): Promise<void> {
        const contents = await this.fileSystem.readFile(uri.fsPath);
        await this.fileSystem.deleteFile(uri.fsPath);
        const doc = await this.documentManager.openTextDocument({ language: PYTHON_LANGUAGE, content: contents });
        const editor = await this.documentManager.showTextDocument(doc);
        // Edit the document so that it is dirty (add a space at the end)
        editor.edit((editBuilder) => {
            editBuilder.insert(new Position(editor.document.lineCount, 0), '\n');
        });
    }

    private showExportFailed(msg: string) {
        this.applicationShell
            .showErrorMessage(
                // tslint:disable-next-line: messages-must-be-localized
                `${localize.DataScience.failedExportMessage()} ${msg}`
            )
            .then();
    }

    private async askOpenFile(uri: Uri): Promise<boolean> {
        const yes = localize.DataScience.openExportFileYes();
        const no = localize.DataScience.openExportFileNo();
        const items = [yes, no];

        const selected = await this.applicationShell
            .showInformationMessage(localize.DataScience.openExportedFileMessage(), ...items)
            .then((item) => item);

        if (selected === yes) {
            this.browserService.launch(uri.toString());
            return true;
        }
        return false;
    }
}
