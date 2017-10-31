import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { InterpreterManager } from '../..';
import { WorkspacePythonPath } from '../../contracts';
import { IPythonPathUpdaterService } from '../types';

export class WorkspacePythonPathUpdaterService implements IPythonPathUpdaterService {
    constructor(private wkspace: Uri) {
    }
    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = workspace.getConfiguration('python', this.wkspace);
        const pythonPathValue = pythonConfig.inspect<string>('pythonPath');

        if (pythonPathValue && pythonPathValue.workspaceValue === pythonPath) {
            return;
        }
        if (pythonPath.startsWith(this.wkspace.fsPath)) {
            // tslint:disable-next-line:no-invalid-template-strings
            pythonPath = path.join('${workspaceRoot}', path.relative(this.wkspace.fsPath, pythonPath));
        }
        await pythonConfig.update('pythonPath', pythonPath, false);
    }
}
