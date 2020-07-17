import { injectable } from 'inversify';
import { CancellationToken, Uri } from 'vscode';
import { ExportBase } from './exportBase';
import { ExportFormat } from './types';

@injectable()
export class ExportToPDF extends ExportBase {
    public async export(source: Uri, target: Uri, token: CancellationToken): Promise<void> {
        await this.executeCommand(source, target, ExportFormat.pdf, token);
    }
}
