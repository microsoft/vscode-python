'use strict';

import * as vscode from 'vscode';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { ItemInfoSource } from './itemInfoSource';

export class PythonHoverProvider implements vscode.HoverProvider {
    private itemInfoSource: ItemInfoSource;

    constructor(jediFactory: JediFactory) {
        this.itemInfoSource = new ItemInfoSource(jediFactory);
    }

    @captureTelemetry(EventName.HOVER_DEFINITION)
    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
    ): Promise<vscode.Hover | undefined> {
        const itemInfos = await this.itemInfoSource.getItemInfoFromDocument(document, position, token);
        if (itemInfos) {
            return new vscode.Hover(itemInfos.map((item) => item.tooltip));
        }
    }
}
