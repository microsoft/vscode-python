import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPython extends ExportBase {
    public sendTelemetryEvent(Telemetry.ExportNotebookAsPython);
    public async export(source: Uri, target: Uri): Promise<void> {
        const contents = await this.importer.importFromFile(source.fsPath);
        await this.fileSystem.writeFile(target.fsPath, contents);
    }
}
