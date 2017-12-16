import * as vscode from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryWhenDone } from '../telemetry';
import { FORMAT } from '../telemetry/constants';
import { StopWatch } from '../telemetry/stopWatch';
import { BaseFormatter } from './baseFormatter';

export class YapfFormatter extends BaseFormatter {
    constructor(serviceContainer: IServiceContainer) {
        super('yapf', Product.yapf, serviceContainer);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        const stopWatch = new StopWatch();
        const settings = PythonSettings.getInstance(document.uri);
        const hasCustomArgs = Array.isArray(settings.formatting.yapfArgs) && settings.formatting.yapfArgs.length > 0;
        const formatSelection = range ? !range.isEmpty : false;

        const yapfArgs = ['--diff'];
        if (formatSelection) {
            // tslint:disable-next-line:no-non-null-assertion
            yapfArgs.push(...['--lines', `${range!.start.line + 1}-${range!.end.line + 1}`]);
        }
        // Yapf starts looking for config file starting from the file path.
        const fallbarFolder = this.getWorkspaceUri(document).fsPath;
        const cwd = this.getDocumentPath(document, fallbarFolder);
        const promise = super.provideDocumentFormattingEdits(document, options, token, yapfArgs, cwd);
        sendTelemetryWhenDone(FORMAT, promise, stopWatch, { tool: 'yapf', hasCustomArgs, formatSelection });
        return promise;
    }
}
