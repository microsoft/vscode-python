import * as path from 'path';
import * as vscode from 'vscode';
import { inject, injectable } from 'inversify';

import { IClipboard, ICommandManager, IWorkspaceService } from '../../common/application/types';
import { IExtensionSingleActivationService } from '../../activation/types';
import { Commands } from '../../common/constants';
import { getSysPath } from '../../common/utils/pythonUtils';
import { IInterpreterPathService } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';

@injectable()
export class CopyImportPathCommand implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    constructor(
        @inject(ICommandManager) private readonly commands: ICommandManager,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IClipboard) private readonly clipboard: IClipboard,
        @inject(IInterpreterPathService) private readonly interpreterPathService: IInterpreterPathService,
    ) {}

    async activate(): Promise<void> {
        this.commands.registerCommand(Commands.CopyImportPath, this.execute, this);
    }

    private async execute(fileUri?: vscode.Uri): Promise<void> {
        const trigger = fileUri ? 'api' : vscode.window.activeTextEditor ? 'contextMenu' : 'palette';
        let outcome: 'success' | 'noFile' | 'notPy' | 'error' = 'success';
        let strategy: 'sysPath' | 'workspace' | 'fallback' | undefined = undefined;
        let exObj: Error | undefined = undefined;

        try {
            const uri = fileUri ?? vscode.window.activeTextEditor?.document.uri;
            if (!uri) {
                outcome = 'noFile';
                return;
            }
            if (!uri.fsPath.endsWith('.py')) {
                outcome = 'notPy';
                return;
            }
            const resource = uri ?? this.workspace.workspaceFolders?.[0]?.uri;
            const pythonPath = this.interpreterPathService.get(resource);
            const [importPath, strat] = this.resolveImportPath(uri.fsPath, pythonPath);
            strategy = strat;
            await this.clipboard.writeText(importPath);
            void vscode.window.showInformationMessage(`Copied: ${importPath}`);
        } catch (ex) {
            outcome = 'error';
            exObj = ex as Error;
        } finally {
            sendTelemetryEvent(
                EventName.COPY_IMPORT_PATH,
                undefined,
                {
                    trigger,
                    outcome,
                    strategy,
                },
                exObj,
            );
        }
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
     * @param absPath Absolute path to a `.py` file.
     * @param pythonPath Optional Python interpreter path to determine `sys.path`.
     * @returns A tuple: [import path in dotted notation, resolution source: 'sysPath' | 'workspace' | 'fallback']
     */
    private resolveImportPath(absPath: string, pythonPath?: string): [string, 'sysPath' | 'workspace' | 'fallback'] {
        // ---------- ① sys.path ----------
        for (const sysRoot of getSysPath(pythonPath)) {
            if (sysRoot && absPath.startsWith(sysRoot)) {
                return [CopyImportPathCommand.toDotted(path.relative(sysRoot, absPath)), 'sysPath'];
            }
        }

        // ---------- ② workspace ----------
        const ws = this.workspace.getWorkspaceFolder(vscode.Uri.file(absPath));
        if (ws && absPath.startsWith(ws.uri.fsPath)) {
            return [CopyImportPathCommand.toDotted(path.relative(ws.uri.fsPath, absPath)), 'workspace'];
        }

        // ---------- ③ fallback ----------
        return [path.basename(absPath, '.py'), 'fallback'];
    }

    private static toDotted(relPath: string): string {
        return relPath.replace(/\.py$/i, '').split(path.sep).filter(Boolean).join('.');
    }
}
