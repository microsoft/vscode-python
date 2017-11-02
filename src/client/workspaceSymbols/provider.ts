import * as _ from 'lodash';
import * as vscode from 'vscode';
import { Commands } from '../common/constants';
import { captureTelemetry } from '../common/telemetry';
import { WORKSPACE_SYMBOLS_GO_TO } from '../common/telemetry/constants';
import { fsExistsAsync } from '../common/utils';
import { Generator } from './generator';
import { parseTags } from './parser';

export class WorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
    public constructor(private tagGenerators: Generator[], private outputChannel: vscode.OutputChannel) {
    }

    @captureTelemetry(WORKSPACE_SYMBOLS_GO_TO)
    public async provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {
        if (this.tagGenerators.length === 0) {
            return [];
        }
        const generatorsWithTagFiles = await Promise.all(this.tagGenerators.map(generator => fsExistsAsync(generator.tagFilePath)));
        if (generatorsWithTagFiles.filter(exists => exists).length !== this.tagGenerators.length) {
            await vscode.commands.executeCommand(Commands.Build_Workspace_Symbols, true, token);
        }

        const generators = await Promise.all(this.tagGenerators.map(async generator => {
            const tagFileExists = await fsExistsAsync(generator.tagFilePath);
            return tagFileExists ? generator : undefined;
        }));

        const promises = generators
            .filter(generator => generator !== undefined && generator.enabled)
            .map(async generator => {
                // load tags
                const items = await parseTags(generator.workspaceFolder.fsPath, generator.tagFilePath, query, token);
                if (!Array.isArray(items)) {
                    return [];
                }
                return items.map(item => new vscode.SymbolInformation(
                    item.symbolName, item.symbolKind, '',
                    new vscode.Location(vscode.Uri.file(item.fileName), item.position)
                ));
            });

        const symbols = await Promise.all(promises);
        return _.flatten(symbols);
    }
}
