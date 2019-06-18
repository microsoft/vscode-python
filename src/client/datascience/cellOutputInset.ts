import { nbformat } from '@jupyterlab/coreutils';
import ansiToHtml from 'ansi-to-html';
import * as path from 'path';
import { Position, Range, TextEditor, Uri, WebviewEditorInset, window } from 'vscode';
import { IWorkspaceService } from '../common/application/types';
import { WebPanel } from '../common/application/webPanel';
import { createDeferred, Deferred } from '../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../constants';
import { DefaultTheme, RegExpValues } from './constants';
import { CssMessages, IGetCssRequest, IGetMonacoThemeRequest } from './messages';
import { ICell, ICodeCssGenerator, IThemeFinder } from './types';

export class CellOutputInset {
    private inset: WebviewEditorInset;
    private themeIsDarkPromise: Deferred<boolean>;

    constructor(
        private line: number,
        private editor: TextEditor,
        private cssGenerator: ICodeCssGenerator,
        private themeFinder: IThemeFinder,
        private workspaceService: IWorkspaceService,
        cell?: ICell
    ) {
        this.inset = this.createInset(1, cell);
        this.themeIsDarkPromise = createDeferred<boolean>();
    }

    public showCellOutput(cell: ICell) {
        this.inset.dispose();
        const numLines = computeSizeInLines(cell);
        this.inset = this.createInset(numLines, cell);
    }

    // tslint:disable-next-line: no-any
    public postMessage(type: string, payload?: any) {
        this.inset.webview.postMessage({ type: type, payload: payload });
    }

    // tslint:disable-next-line: no-any
    protected onMessage(message: string, payload: any) {
        switch (message) {
            case CssMessages.GetCssRequest:
                this.handleCssRequest(payload as IGetCssRequest).ignoreErrors();
                break;
            case CssMessages.GetMonacoThemeRequest:
                this.handleMonacoThemeRequest(payload as IGetMonacoThemeRequest).ignoreErrors();
                break;
            default:
                break;
        }
    }

    private async handleCssRequest(request: IGetCssRequest): Promise<void> {
        if (!this.themeIsDarkPromise.resolved) {
            this.themeIsDarkPromise.resolve(request.isDark);
        } else {
            this.themeIsDarkPromise = createDeferred<boolean>();
            this.themeIsDarkPromise.resolve(request.isDark);
        }
        const workbench = this.workspaceService.getConfiguration('workbench');
        const theme = !workbench ? DefaultTheme : workbench.get<string>('colorTheme', DefaultTheme);
        // const settings = this.generateDataScienceExtraSettings();
        const isDark = await this.themeFinder.isThemeDark(theme);
        const css = await this.cssGenerator.generateThemeCss(request.isDark, theme);
        return this.postMessage(CssMessages.GetCssResponse, { css, theme: theme, knownDark: isDark });
    }

    private async handleMonacoThemeRequest(request: IGetMonacoThemeRequest): Promise<void> {
        if (!this.themeIsDarkPromise.resolved) {
            this.themeIsDarkPromise.resolve(request.isDark);
        } else {
            this.themeIsDarkPromise = createDeferred<boolean>();
            this.themeIsDarkPromise.resolve(request.isDark);
        }
        const workbench = this.workspaceService.getConfiguration('workbench');
        const theme = !workbench ? DefaultTheme : workbench.get<string>('colorTheme', DefaultTheme);
        // const settings = this.generateDataScienceExtraSettings();
        const monacoTheme = await this.cssGenerator.generateMonacoTheme(request.isDark, theme);
        return this.postMessage(CssMessages.GetMonacoThemeResponse, { theme: monacoTheme });
    }

    private createInset(heightInLines: number, cell: ICell | undefined) {
        const insetRange = new Range(new Position(this.line, 0), new Position(this.line + heightInLines, 0));
        const htmldir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'inset-react');
        const mainScriptPath = path.join(htmldir, 'index_bundle.js');
        const inset = window.createWebviewTextEditorInset(this.editor, insetRange, { enableScripts: true, localResourceRoots: [Uri.file(htmldir)] });
        inset.webview.html = WebPanel.generateReactHtml(mainScriptPath, undefined, { cell: cell });
        inset.webview.onDidReceiveMessage(m => this.onMessage(m.type, m.payload));
        return inset;
    }

}

function computeSizeInLines(cell: ICell): number {
    const codeCell = cell.data as nbformat.ICodeCell;
    if (!codeCell) { return 1; }

    function computeOutputSizeInLines(output: nbformat.IOutput): number {
        if (nbformat.isExecuteResult(output) || nbformat.isDisplayData(output)) {
            const bundle = output.data;
            const svg = bundle['image/svg+xml'] as string;
            if (svg) {
                const heightMatch = RegExpValues.SvgHeightRegex.exec(svg);
                if (heightMatch && heightMatch.length > 2) {
                    let h = parseFloat(heightMatch[2]);
                    if (heightMatch[2].indexOf('pt') > 0) {
                        // convert from points
                        h *= 96 / 72;
                    }
                    const lineHeight = 22; // how to look this up?
                    return h / lineHeight;
                }
            }
            const txt = bundle['text/plain'] as nbformat.MultilineString;
            if (txt) {
                return txt.length;
            }
        } else if (nbformat.isStream(output)) {
            return Array.isArray(output.text) ? output.text.length : output.text.split('\n').length;
        } else if (nbformat.isError(output)) {
            const converter = new ansiToHtml();
            const trace = converter.toHtml(output.traceback.join('\n'));
            return trace.split('\n').length;
        }
        return 5;
    }

    return codeCell.outputs.reduce((sum, output) =>
        sum + computeOutputSizeInLines(output), 0);
}
