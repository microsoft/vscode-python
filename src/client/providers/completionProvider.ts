'use strict';

import * as vscode from 'vscode';
import { IConfigurationService } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { COMPLETION } from '../telemetry/constants';
import { CompletionSource } from './completionSource';

export class PythonCompletionItemProvider implements vscode.CompletionItemProvider {
    private completionSource: CompletionSource;
    private configService: IConfigurationService;

    constructor(jediFactory: JediFactory, serviceContainer: IServiceContainer) {
        this.completionSource = new CompletionSource(jediFactory);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    }

    @captureTelemetry(COMPLETION)
    public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken):
        Promise<vscode.CompletionItem[]> {
        const items = await this.completionSource.getVsCodeCompletionItems(document, position, token);
        if (this.configService.isTestExecution()) {
            for (let i = 0; i < Math.min(3, items.length); i += 1) {
                items[i] = await this.resolveCompletionItem(items[i], token);
            }
        }
        return items;
    }

    public async resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): Promise<vscode.CompletionItem> {
        if (!item.documentation) {
            const itemInfos = await this.completionSource.getDocumentation(item, token);
            if (itemInfos && itemInfos.length > 0) {
                item.documentation = itemInfos[0].tooltip;
            }
        }
        return item;
    }
}
