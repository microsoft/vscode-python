import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPython extends ExportBase {
    public async export(source: Uri, target: Uri): Promise<void> {
        sendTelemetryEvent(Telemetry.ExportNotebookAsPython);
        const contents = await this.importer.importFromFile(source.fsPath);
        await this.fileSystem.writeFile(target.fsPath, contents);
    }
}
