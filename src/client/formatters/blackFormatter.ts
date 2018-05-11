// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import { Product } from '../common/installer/productInstaller';
import { StopWatch } from '../common/stopWatch';
import { IConfigurationService } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryWhenDone } from '../telemetry';
import { FORMAT } from '../telemetry/constants';
import { BaseFormatter } from './baseFormatter';

export class BlackFormatter extends BaseFormatter {
    constructor(serviceContainer: IServiceContainer) {
        super('black', Product.black, serviceContainer);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        const stopWatch = new StopWatch();
        const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(document.uri);
        const hasCustomArgs = Array.isArray(settings.formatting.blackArgs) && settings.formatting.blackArgs.length > 0;
        const formatSelection = range ? !range.isEmpty : false;

        if (formatSelection) {
            const errorMessage = async () => {
                // Black does not support partial formatting on purpose.
                await vscode.window.showErrorMessage('Black does not support the "Format Selection" command');
                return [] as vscode.TextEdit[];
            };

            return errorMessage();
        }

        const blackArgs = ['--diff', '--quiet'];
        const promise = super.provideDocumentFormattingEdits(document, options, token, blackArgs);
        sendTelemetryWhenDone(FORMAT, promise, stopWatch, { tool: 'black', hasCustomArgs, formatSelection });
        return promise;
    }
}
