import { inject, injectable } from 'inversify';
import { Position, Uri } from 'vscode';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { IBrowserService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { ExportFormat } from './types';

@injectable()
export class ExportFileOpener {
    constructor(
        @inject(IDocumentManager) protected readonly documentManager: IDocumentManager,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IBrowserService) private readonly browserService: IBrowserService
    ) {}

    public async openFile(format: ExportFormat, uri: Uri) {
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
