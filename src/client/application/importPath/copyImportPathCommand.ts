import * as path from 'path';
import * as vscode from 'vscode';
import { inject, injectable } from 'inversify';

import { IClipboard, ICommandManager, IWorkspaceService } from '../../common/application/types';
import { IExtensionSingleActivationService } from '../../activation/types';
import { Commands } from '../../common/constants';
import { getSysPath } from '../../common/utils/pythonUtils';

@injectable()
export class CopyImportPathCommand implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    constructor(
        @inject(ICommandManager) private readonly commands: ICommandManager,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IClipboard) private readonly clipboard: IClipboard,
    ) {}

    async activate(): Promise<void> {
        this.commands.registerCommand(Commands.CopyImportPath, this.execute, this);
    }

    private async execute(fileUri?: vscode.Uri): Promise<void> {
        const uri = fileUri ?? vscode.window.activeTextEditor?.document.uri;
        if (!uri || uri.scheme !== 'file' || !uri.fsPath.endsWith('.py')) {
            void vscode.window.showWarningMessage('No Python file selected for import-path copy.');
            return;
        }

        const importPath = this.resolveImportPath(uri.fsPath);
        await this.clipboard.writeText(importPath);
        void vscode.window.showInformationMessage(`Copied: ${importPath}`);
    }

    /**
     * Resolves a Python import-style dotted path from an absolute file path.
     *
     * The resolution follows a 3-level fallback strategy:
     *
     * 1. If the file is located under any entry in `sys.path`, the path relative to that entry is used.
     * 2. If the file is located under the current workspace folder, the path relative to the workspace root is used.
     * 3. Otherwise, the import path falls back to the file name (without extension).
     *
     * @param absPath - The absolute path to a `.py` file.
     * @returns The resolved import path in dotted notation (e.g., 'pkg.module').
     */
    private resolveImportPath(absPath: string): string {
        // ---------- ① sys.path ----------
        for (const sysRoot of getSysPath()) {
            if (sysRoot && absPath.startsWith(sysRoot)) {
                return CopyImportPathCommand.toDotted(path.relative(sysRoot, absPath));
            }
        }

        // ---------- ② workspaceFolder ----------
        const ws = this.workspace.getWorkspaceFolder(vscode.Uri.file(absPath));
        if (ws && absPath.startsWith(ws.uri.fsPath)) {
            return CopyImportPathCommand.toDotted(path.relative(ws.uri.fsPath, absPath));
        }

        // ---------- ③ fallback ----------
        return path.basename(absPath, '.py');
    }

    private static toDotted(relPath: string): string {
        return relPath.replace(/\.py$/i, '').split(path.sep).filter(Boolean).join('.');
    }
}
