// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { createScanner, parse, SyntaxKind } from 'jsonc-parser';
import { CancellationToken, DebugConfiguration, Position, TextDocument, WorkspaceEdit } from 'vscode';
import { IExtensionActivationService } from '../../../../activation/types';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../../../common/application/types';
import { IDisposableRegistry, Resource } from '../../../../common/types';
import { noop } from '../../../../common/utils/misc';
import { captureTelemetry } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { IDebugConfigurationService } from '../../types';

type PositionOfCursor = 'InsideEmptyArray' | 'BeforeItem' | 'AfterItem';

export class LaunchJsonUpdaterServiceHelper {
    constructor(private readonly commandManager: ICommandManager,
        private readonly workspace: IWorkspaceService,
        private readonly documentManager: IDocumentManager,
        private readonly configurationProvider: IDebugConfigurationService) { }
    @captureTelemetry(EventName.DEBUGGER_CONFIGURATION_PROMPTS_IN_LAUNCH_JSON)
    public async selectAndInsertDebugConfig(document: TextDocument, position: Position, token: CancellationToken): Promise<void> {
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
    public async insertDebugConfiguration(document: TextDocument, position: Position, config: DebugConfiguration): Promise<void> {
        const cursorPosition = this.getCursorPositionInConfigurationsArray(document, position);
        if (!cursorPosition) {
            return;
        }
        const formattedJson = this.getTextForInsertion(config, cursorPosition);
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
    public getTextForInsertion(config: DebugConfiguration, cursorPosition: PositionOfCursor) {
        const json = JSON.stringify(config);
        if (cursorPosition === 'AfterItem') {
            return `,${json}`;
        }
        if (cursorPosition === 'BeforeItem') {
            return `${json},`;
        }
        return json;
    }
    public getCursorPositionInConfigurationsArray(document: TextDocument, position: Position): PositionOfCursor | undefined {
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
        const configuration = parse(document.getText(), [], { allowTrailingComma: true, disallowComments: false }) as { configurations: [] };
        return (!configuration || !Array.isArray(configuration.configurations) || configuration.configurations.length === 0);
    }
}

@injectable()
export class LaunchJsonUpdaterService implements IExtensionActivationService {
    constructor(@inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IDebugConfigurationService) private readonly configurationProvider: IDebugConfigurationService) { }
    public async activate(_resource: Resource): Promise<void> {
        const handler = new LaunchJsonUpdaterServiceHelper(this.commandManager, this.workspace, this.documentManager, this.configurationProvider);
        this.disposableRegistry.push(this.commandManager.registerCommand('python.SelectAndInsertDebugConfiguration', handler.selectAndInsertDebugConfig, handler));
    }
}
