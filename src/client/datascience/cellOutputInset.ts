import { TextEditor, Position, Range, Uri, WebviewEditorInset, window } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../constants';
import * as path from 'path';
import { WebPanel } from '../common/application/webPanel';
import { CssMessages, IGetCssRequest, IGetMonacoThemeRequest } from './messages';
import { ICodeCssGenerator, IThemeFinder } from './types';
import { Deferred, createDeferred } from '../common/utils/async';
import { DefaultTheme } from './constants';
import { IWorkspaceService } from '../common/application/types';

export class CellOutputInset {
    private inset: WebviewEditorInset;
    private themeIsDarkPromise: Deferred<boolean>;

    constructor(
        range: Range,
        editor: TextEditor,
        private cssGenerator: ICodeCssGenerator,
        private themeFinder: IThemeFinder,
        private workspaceService: IWorkspaceService
    ) {
        const insetRange = new Range(new Position(range.end.line, 0), new Position(2 * range.end.line - range.start.line, 0));
        const htmldir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'inset-react');
        const mainScriptPath = path.join(htmldir, 'index_bundle.js');
        this.inset = window.createWebviewTextEditorInset(editor, insetRange, { enableScripts: true, localResourceRoots: [Uri.file(htmldir)] });
        this.inset.webview.html = WebPanel.generateReactHtml(mainScriptPath);

        this.themeIsDarkPromise = createDeferred<boolean>();

        this.inset.webview.onDidReceiveMessage(m => this.onMessage(m.type, m.payload));
    }

    public postMessage(type: string, payload?: any) {
        this.inset.webview.postMessage({ type: type, payload: payload });
    }

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


}