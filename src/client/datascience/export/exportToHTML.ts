import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToHTML extends ExportBase {
    public async export(source: Uri, target: Uri): Promise<void> {
        const daemon = await this.getDaemon();
        if (!daemon) {
            return;
        }

        const args = [source.fsPath, '--to', 'html', '--stdout'];
        const content = await daemon
            .execModule('jupyter', ['nbconvert'].concat(args), { throwOnStdErr: false, encoding: 'utf8' })
            .then((output) => output.stdout);

        await this.writeFile(target, content);
    }
}
