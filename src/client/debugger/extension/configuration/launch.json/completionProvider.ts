// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { getLocation } from 'jsonc-parser';
import * as path from 'path';
import { CancellationToken, CompletionItem, CompletionItemKind, CompletionItemProvider, Position, SnippetString, TextDocument } from 'vscode';
import { IExtensionSingleActivationService } from '../../../../activation/types';
import { ILanguageService } from '../../../../common/application/types';
import { IDisposableRegistry } from '../../../../common/types';
import { DebugConfigStrings } from '../../../../common/utils/localize';

const configurationNodeName = 'configurations';
enum JsonLanguages {
    json = 'json',
    jsonWithComments = 'jsonc'
}

@injectable()
export class LaunchJsonCompletionProvider implements CompletionItemProvider, IExtensionSingleActivationService {
    constructor(
        @inject(ILanguageService) private readonly languageService: ILanguageService,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry
    ) {}
    public async activate(): Promise<void> {
        this.disposableRegistry.push(this.languageService.registerCompletionItemProvider({ language: JsonLanguages.json }, this));
        this.disposableRegistry.push(this.languageService.registerCompletionItemProvider({ language: JsonLanguages.jsonWithComments }, this));
    }
    public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Promise<CompletionItem[]> {
        if (!this.canProvideCompletions(document, position)) {
            return [];
        }

        return [
            {
                command: {
                    command: 'python.SelectAndInsertDebugConfiguration',
                    title: DebugConfigStrings.launchJsonCompletions.description(),
                    arguments: [document, position, token]
                },
                documentation: DebugConfigStrings.launchJsonCompletions.description(),
                sortText: 'AAAA',
                preselect: true,
                kind: CompletionItemKind.Enum,
                label: DebugConfigStrings.launchJsonCompletions.label(),
                insertText: new SnippetString()
            }
        ];
    }
    public canProvideCompletions(document: TextDocument, position: Position) {
        if (path.basename(document.uri.fsPath) !== 'launch.json') {
            return false;
        }
        const location = getLocation(document.getText(), document.offsetAt(position));
        // Cursor must be inside the configurations array and not in any nested items.
        // Hence path[0] = array, path[1] = array element index.
        return location.path[0] === configurationNodeName && location.path.length === 2;
    }
}
