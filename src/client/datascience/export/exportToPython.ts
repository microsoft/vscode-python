import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { IPathUtils } from '../../common/types';
import { ExportBase } from './exportBase';

@injectable()
export class ExportToPython extends ExportBase {
    public async export(source: Uri, target: Uri): Promise<void> {
        const activeEditor = this.notebookEditorProvider.activeEditor;
        const content = activeEditor?.model ? activeEditor.model.getContent() : '';
        await this.fileSystem.writeFile(target.toString(), content, 'utf-8');
    }
}
