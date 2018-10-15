// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { IConfigurationService, Product } from '../common/types';
import { StopWatch } from '../common/utils/stopWatch';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryWhenDone } from '../telemetry';
import { FORMAT } from '../telemetry/constants';
import { BaseFormatter } from './baseFormatter';

export class PyformatFormatter extends BaseFormatter {
    constructor(serviceContainer: IServiceContainer) {
        super('pyformat', Product.pyformat, serviceContainer);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        const stopWatch = new StopWatch();
        const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(document.uri);
        const hasCustomArgs = Array.isArray(settings.formatting.yapfArgs) && settings.formatting.yapfArgs.length > 0;
        const formatSelection = range ? !range.isEmpty : false;

        if (formatSelection) {
            const errorMessage = async () => {
                // Pyformat does not support partial formatting on purpose.
                await vscode.window.showErrorMessage('Pyformat does not support the "Format Selection" command');
                return [] as vscode.TextEdit[];
            };

            return errorMessage();
        }

        const pyformatArgs = ['--in_place'];
        const promise = super.provideDocumentFormattingEdits(document, options, token, pyformatArgs);
        sendTelemetryWhenDone(FORMAT, promise, stopWatch, { tool: 'pyformat', hasCustomArgs, formatSelection });
        return promise;
    }
}
