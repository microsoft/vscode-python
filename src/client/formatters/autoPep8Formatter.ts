import * as vscode from 'vscode';
import { Product } from '../common/installer/productInstaller';
import { IConfigurationService } from '../common/types';
import { StopWatch } from '../common/utils/stopWatch';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryWhenDone } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { BaseFormatter } from './baseFormatter';

export class AutoPep8Formatter extends BaseFormatter {
    constructor(serviceContainer: IServiceContainer) {
        super('autopep8', Product.autopep8, serviceContainer);
    }

    public formatDocument(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken,
        range?: vscode.Range
    ): Thenable<vscode.TextEdit[]> {
        const stopWatch = new StopWatch();
        const settings = this.serviceContainer
            .get<IConfigurationService>(IConfigurationService)
            .getSettings(document.uri);
        const hasCustomArgs =
            Array.isArray(settings.formatting.autopep8Args) && settings.formatting.autopep8Args.length > 0;
        const formatSelection = range ? !range.isEmpty : false;

        const autoPep8Args = ['--diff'];
        if (formatSelection) {
            // tslint:disable-next-line:no-non-null-assertion
            autoPep8Args.push(
                ...['--line-range', (range!.start.line + 1).toString(), (range!.end.line + 1).toString()]
            );
        }
        const promise = super.provideDocumentFormattingEdits(document, options, token, autoPep8Args);
        sendTelemetryWhenDone(EventName.FORMAT, promise, stopWatch, {
            tool: 'autopep8',
            hasCustomArgs,
            formatSelection
        });
        return promise;
    }
}
