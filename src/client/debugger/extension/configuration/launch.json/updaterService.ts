// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { createScanner, parse, SyntaxKind } from 'jsonc-parser';
import { CancellationToken, DebugConfiguration, Position, Range, TextDocument, WorkspaceEdit } from 'vscode';
import { IExtensionSingleActivationService } from '../../../../activation/types';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../../../common/application/types';
import { IDisposableRegistry } from '../../../../common/types';
import { noop } from '../../../../common/utils/misc';
import { captureTelemetry } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { IDebugConfigurationService } from '../../types';

type PositionOfCursor = 'InsideEmptyArray' | 'BeforeItem' | 'AfterItem';
type PositionOfComma = 'BeforeCursor';

export class LaunchJsonUpdaterServiceHelper {
    constructor(
        private readonly commandManager: ICommandManager,
        private readonly workspace: IWorkspaceService,
        private readonly documentManager: IDocumentManager,
        private readonly configurationProvider: IDebugConfigurationService
    ) {}
    @captureTelemetry(EventName.DEBUGGER_CONFIGURATION_PROMPTS_IN_LAUNCH_JSON)
    public async selectAndInsertDebugConfig(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): Promise<void> {
        if (this.documentManager.activeTextEditor && this.documentManager.activeTextEditor.document === document) {
            const folder = this.workspace.getWorkspaceFolder(document.uri);
            const configs = await this.configurationProvider.provideDebugConfigurations!(folder, token);

            if (!token.isCancellationRequested && Array.isArray(configs) && configs.length > 0) {
                // Always use the first available debug configuration.
                await this.insertDebugConfiguration(document, position, configs[0]);
            }
        }
    }
    /**
     * Inserts the debug configuration into the document.
     * Invokes the document formatter to ensure JSON is formatted nicely.
     * @param {TextDocument} document
     * @param {Position} position
     * @param {DebugConfiguration} config
     * @returns {Promise<void>}
     * @memberof LaunchJsonCompletionItemProvider
     */
    public async insertDebugConfiguration(
        document: TextDocument,
        position: Position,
        config: DebugConfiguration
    ): Promise<void> {
        const cursorPosition = this.getCursorPositionInConfigurationsArray(document, position);
        if (!cursorPosition) {
            return;
        }
        const commaPosition = this.isCommaImmediatelyBeforeCursor(document, position) ? 'BeforeCursor' : undefined;
        const formattedJson = this.getTextForInsertion(config, cursorPosition, commaPosition);
        const workspaceEdit = new WorkspaceEdit();
        workspaceEdit.insert(document.uri, position, formattedJson);
        await this.documentManager.applyEdit(workspaceEdit);
        this.commandManager.executeCommand('editor.action.formatDocument').then(noop, noop);
    }
    /**
     * Gets the string representation of the debug config for insertion in the document.
     * Adds necessary leading or trailing commas (remember the text is added into an array).
     * @param {TextDocument} document
     * @param {Position} position
     * @param {DebugConfiguration} config
     * @returns
     * @memberof LaunchJsonCompletionItemProvider
     */
    public getTextForInsertion(
        config: DebugConfiguration,
        cursorPosition: PositionOfCursor,
        commaPosition?: PositionOfComma
    ) {
        const json = JSON.stringify(config);
        if (cursorPosition === 'AfterItem') {
            // If we already have a comma immediatley before the cursor, then no need of adding a comma.
            return commaPosition === 'BeforeCursor' ? json : `,${json}`;
        }
        if (cursorPosition === 'BeforeItem') {
            return `${json},`;
        }
        return json;
    }
    public getCursorPositionInConfigurationsArray(
        document: TextDocument,
        position: Position
    ): PositionOfCursor | undefined {
        if (this.isConfigurationArrayEmpty(document)) {
            return 'InsideEmptyArray';
        }
        const scanner = createScanner(document.getText(), true);
        scanner.setPosition(document.offsetAt(position));
        const nextToken = scanner.scan();
        if (nextToken === SyntaxKind.CommaToken || nextToken === SyntaxKind.CloseBracketToken) {
            return 'AfterItem';
        }
        if (nextToken === SyntaxKind.OpenBraceToken) {
            return 'BeforeItem';
        }
    }
    public isConfigurationArrayEmpty(document: TextDocument): boolean {
        const configuration = parse(document.getText(), [], { allowTrailingComma: true, disallowComments: false }) as {
            configurations: [];
        };
        return (
            !configuration || !Array.isArray(configuration.configurations) || configuration.configurations.length === 0
        );
    }
    public isCommaImmediatelyBeforeCursor(document: TextDocument, position: Position) {
        const line = document.lineAt(position.line);
        // Get text from start of line until the cursor.
        const currentLine = document.getText(new Range(line.range.start, position));
        if (currentLine.trim().endsWith(',')) {
            return true;
        }
        // If there are other characters, then don't bother.
        if (currentLine.trim().length !== 0) {
            return false;
        }

        // Keep walking backwards until we hit a non-comma character or a comm character.
        let startLineNumber = position.line - 1;
        while (startLineNumber > 0) {
            const lineText = document.lineAt(startLineNumber).text;
            if (lineText.trim().endsWith(',')) {
                return true;
            }
            // If there are other characters, then don't bother.
            if (lineText.trim().length !== 0) {
                return false;
            }
            startLineNumber -= 1;
            continue;
        }
        return false;
    }
}

@injectable()
export class LaunchJsonUpdaterService implements IExtensionSingleActivationService {
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IDebugConfigurationService) private readonly configurationProvider: IDebugConfigurationService
    ) {}
    public async activate(): Promise<void> {
        const handler = new LaunchJsonUpdaterServiceHelper(
            this.commandManager,
            this.workspace,
            this.documentManager,
            this.configurationProvider
        );
        this.disposableRegistry.push(
            this.commandManager.registerCommand(
                'python.SelectAndInsertDebugConfiguration',
                handler.selectAndInsertDebugConfig,
                handler
            )
        );
    }
}
