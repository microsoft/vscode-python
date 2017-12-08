'use strict';

import * as vscode from 'vscode';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { HOVER_DEFINITION } from '../telemetry/constants';
import { HoverSource } from './hoverSource';

export class PythonHoverProvider implements vscode.HoverProvider {
    private hoverSource: HoverSource;

    constructor(jediFactory: JediFactory) {
        this.hoverSource = new HoverSource(jediFactory);
    }

    @captureTelemetry(HOVER_DEFINITION)
    public async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
        : Promise<vscode.Hover | undefined> {
        return this.hoverSource.getVsCodeHover(document, position, token);
    }
}
