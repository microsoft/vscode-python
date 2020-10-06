import { injectable } from 'inversify';
import { CancellationToken, Uri } from 'vscode';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { ExportBase } from './exportBase';
import { ExportFormat } from './types';

@injectable()
export class ExportToHTML extends ExportBase {
    public async export(
        source: Uri,
        target: Uri,
        interpreter: PythonEnvironment,
        token: CancellationToken
    ): Promise<void> {
        await this.executeCommand(source, target, ExportFormat.html, interpreter, token);
    }
}
