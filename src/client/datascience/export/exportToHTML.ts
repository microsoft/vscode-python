import { injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToHTML extends ExportBase {
    public async export(source: Uri, target: Uri): Promise<void> {
        const args = [
            source.fsPath,
            '--to',
            'html',
            '--output',
            path.basename(target.fsPath),
            '--output-dir',
            path.dirname(target.fsPath)
        ];
        await this.executeCommand(source, args);
        sendTelemetryEvent(Telemetry.ExportedNotebookAsHTML);
    }
}
