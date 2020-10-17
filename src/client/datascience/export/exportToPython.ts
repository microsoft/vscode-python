import { injectable } from 'inversify';
import { CancellationToken, Uri } from 'vscode';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPython extends ExportBase {
    public async export(
        source: Uri,
        target: Uri,
        interpreter: PythonEnvironment,
        token: CancellationToken
    ): Promise<void> {
        if (token.isCancellationRequested) {
            return;
        }
        const contents = await this.importer.importFromFile(source, interpreter);
        await this.fs.writeFile(target, contents);
    }
}
