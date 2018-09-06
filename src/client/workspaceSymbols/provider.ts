'use strict';

import * as _ from 'lodash';
import {
    CancellationToken, Location, SymbolInformation,
    Uri, WorkspaceSymbolProvider as IWorspaceSymbolProvider
} from 'vscode';
import { ICommandManager } from '../common/application/types';
import { Commands } from '../common/constants';
import { IFileSystem } from '../common/platform/types';
import { captureTelemetry } from '../telemetry';
import { WORKSPACE_SYMBOLS_GO_TO } from '../telemetry/constants';
import { Generator } from './generator';
import { parseTags } from './parser';

export class WorkspaceSymbolProvider implements IWorspaceSymbolProvider {
    public constructor(
        private fs: IFileSystem,
        private commands: ICommandManager,
        private tagGenerators: Generator[]
    ) {
    }

    @captureTelemetry(WORKSPACE_SYMBOLS_GO_TO)
    public async provideWorkspaceSymbols(query: string, token: CancellationToken): Promise<SymbolInformation[]> {
        if (this.tagGenerators.length === 0) {
            return [];
        }
        const generatorsWithTagFiles = await Promise.all(this.tagGenerators.map(generator => this.fs.fileExists(generator.tagFilePath)));
        if (generatorsWithTagFiles.filter(exists => exists).length !== this.tagGenerators.length) {
            await this.commands.executeCommand(Commands.Build_Workspace_Symbols, true, token);
        }

        const generators = await Promise.all(this.tagGenerators.map(async generator => {
            const tagFileExists = await this.fs.fileExists(generator.tagFilePath);
            return tagFileExists ? generator : undefined;
        }));

        const promises = generators
            .filter(generator => generator !== undefined && generator.enabled)
            .map(async generator => {
                // load tags
                const items = await parseTags(generator!.workspaceFolder.fsPath, generator!.tagFilePath, query, token);
                if (!Array.isArray(items)) {
                    return [];
                }
                return items.map(item => new SymbolInformation(
                    item.symbolName, item.symbolKind, '',
                    new Location(Uri.file(item.fileName), item.position)
                ));
            });

        const symbols = await Promise.all(promises);
        return _.flatten(symbols);
    }
}
