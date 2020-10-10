import { injectable } from 'inversify';
import { CancellationToken, Uri } from 'vscode';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { ExportBase } from './exportBase';
import { ExportFormat } from './types';

@injectable()
export class ExportToPDF extends ExportBase {
    public async export(
        source: Uri,
        target: Uri,
        interpreter: PythonEnvironment,
        token: CancellationToken
    ): Promise<void> {
        await this.executeCommand(source, target, ExportFormat.pdf, interpreter, token);
    }
}
