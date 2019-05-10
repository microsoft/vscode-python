// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { JSONArray, JSONObject } from '@phosphor/coreutils';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as path from 'path';
import * as stripJsonComments from 'strip-json-comments';

import { IWorkspaceService } from '../common/application/types';
import { IConfigurationService, ILogger } from '../common/types';
import { DefaultTheme } from './constants';
import { ICodeCssGenerator, IThemeFinder } from './types';

// tslint:disable:no-any
const DarkTheme = 'dark';
const LightTheme = 'light';

// These are based on the colors generated by 'Default Light+' and are only set when we
// are ignoring themes.
//tslint:disable:no-multiline-string object-literal-key-quotes
const DefaultCssVars: { [key: string] : string } = {
    'light' : `
    :root {
        --override-widget-background: #f3f3f3;
        --override-foreground: #000000;
        --override-background: #FFFFFF;
        --override-selection-background: #add6ff;
        --override-watermark-color: #cccedb;
        --override-tabs-background: #f3f3f3;
        --override-progress-background: #0066bf;
        --override-badge-background: #c4c4c4;
        --override-lineHighlightBorder: #eeeeee;
    }
`,
    'dark' : `
    :root {
        --override-widget-background: #1e1e1e;
        --override-foreground: #d4d4d4;
        --override-background: #1e1e1e;
        --override-selection-background: #264f78;
        --override-watermark-color: #3f3f46;
        --override-tabs-background: #252526;
        --override-progress-background: #0066bf;
        --override-badge-background: #4d4d4d;
        --override-lineHighlightBorder: #282828;
    }
`
};

// These colors below should match colors that come from either the Default Light+ theme or the Default Dark+ theme.
// They are used when we can't find a theme json file.
const DefaultColors: { [key: string] : string } = {
    'light.comment'         : '#008000',
    'light.constant.numeric': '#09885a',
    'light.string'          : '#a31515',
    'light.keyword.control' : '#AF00DB',
    'light.keyword.operator': '#000000',
    'light.variable'        : '#001080',
    'light.entity.name.type': '#267f99',
    'light.support.function': '#795E26',
    'light.punctuation'     : '#000000',
    'dark.comment'          : '#6A9955',
    'dark.constant.numeric' : '#b5cea8',
    'dark.string'           : '#ce9178',
    'dark.keyword.control'  : '#C586C0',
    'dark.keyword.operator' : '#d4d4d4',
    'dark.variable'         : '#9CDCFE',
    'dark.entity.name.type' : '#4EC9B0',
    'dark.support.function' : '#DCDCAA',
    'dark.punctuation'      : '#1e1e1e'
};

interface IApplyThemeArgs {
    tokenColors?: JSONArray | null;
    baseColors?: JSONObject | null;
    fontFamily: string;
    fontSize: number;
    isDark: boolean;
    defaultStyle: string | undefined;
}

// This class generates css using the current theme in order to colorize code.
//
// NOTE: This is all a big hack. It's relying on the theme json files to have a certain format
// in order for this to work.
// See this vscode issue for the real way we think this should happen:
// https://github.com/Microsoft/vscode/issues/32813
@injectable()
export class CodeCssGenerator implements ICodeCssGenerator {
    constructor(
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IThemeFinder) private themeFinder: IThemeFinder,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ILogger) private logger: ILogger) {
    }

    public generateThemeCss(isDark: boolean, theme: string): Promise<string> {
        return this.applyThemeData(isDark, theme, '', this.generateCss.bind(this));
    }

    public generateMonacoTheme(isDark: boolean, theme: string) : Promise<JSONObject> {
        return this.applyThemeData(isDark, theme, {}, this.generateMonacoThemeObject.bind(this));
    }

    private async applyThemeData<T>(isDark: boolean, theme: string, defaultT: T, applier: (args: IApplyThemeArgs) => T) : Promise<T> {
        let result = defaultT;
        try {
            // First compute our current theme.
            const ignoreTheme = this.configService.getSettings().datascience.ignoreVscodeTheme ? true : false;
            theme = ignoreTheme ? DefaultTheme : theme;
            const editor = this.workspaceService.getConfiguration('editor', undefined);
            const fontFamily = editor ? editor.get<string>('fontFamily', 'Consolas, \'Courier New\', monospace') : 'Consolas, \'Courier New\', monospace';
            const fontSize = editor ? editor.get<number>('fontSize', 14) : 14;
            const isDarkUpdated = ignoreTheme ? false : isDark;

            // Then we have to find where the theme resources are loaded from
            if (theme) {
                this.logger.logInformation('Searching for token colors ...');
                const tokenColors = await this.findTokenColors(theme);
                const baseColors = await this.findBaseColors(theme);

                // The tokens object then contains the necessary data to generate our css
                if (tokenColors && fontFamily && fontSize) {
                    this.logger.logInformation('Using colors to generate CSS ...');
                    result = applier({ tokenColors, baseColors, fontFamily, fontSize, isDark: isDarkUpdated, defaultStyle: ignoreTheme ? LightTheme : undefined });
                } else if (tokenColors === null && fontFamily && fontSize) {
                    // No colors found. See if we can figure out what type of theme we have
                    const style = isDark ? DarkTheme : LightTheme ;
                    result = applier({ fontFamily, fontSize, isDark: isDarkUpdated, defaultStyle: style});
                }
            }
        } catch (err) {
            // On error don't fail, just log
            this.logger.logError(err);
        }

        return result;
    }

    private getScopes(entry: any) : JSONArray {
        if (entry && entry.scope) {
            return Array.isArray(entry.scope) ? entry.scope as JSONArray : entry.scope.toString().split(',');
        }
        return [];
    }

    private matchTokenColor(tokenColors: JSONArray, scope: string) : number {
        return tokenColors.findIndex((entry: any) => {
            const scopeArray = this.getScopes(entry);
            if (scopeArray.find(v => v !== null && v !== undefined && v.toString().trim() === scope)) {
                return true;
            }
            return false;
        });
    }

    private getScopeStyle = (tokenColors: JSONArray | null | undefined, scope: string, secondary: string, defaultStyle: string | undefined): { color: string; fontStyle: string } => {
        // Search through the scopes on the json object
        if (tokenColors) {
            let match = this.matchTokenColor(tokenColors, scope);
            if (match < 0 && secondary) {
                match = this.matchTokenColor(tokenColors, secondary);
            }
            const found = match >= 0 ? tokenColors[match] as any : null;
            if (found !== null) {
                const settings = found.settings;
                if (settings && settings !== null) {
                    const fontStyle = settings.fontStyle ? settings.fontStyle : 'normal';
                    const foreground = settings.foreground ? settings.foreground : 'var(--vscode-editor-foreground)';

                    return { fontStyle, color: foreground };
                }
            }
        }

        // Default to editor foreground
        return { color: this.getDefaultColor(defaultStyle, scope), fontStyle: 'normal' };
    }

    private getDefaultColor(style: string | undefined, scope: string) : string {
        return style ? DefaultColors[`${style}.${scope}`] : 'var(--override-foreground, var(--vscode-editor-foreground))';
    }

    // tslint:disable-next-line:max-func-body-length
    private generateCss(args: IApplyThemeArgs): string {

        // There's a set of values that need to be found
        const commentStyle = this.getScopeStyle(args.tokenColors, 'comment', 'comment', args.defaultStyle);
        const numericStyle = this.getScopeStyle(args.tokenColors, 'constant.numeric', 'constant', args.defaultStyle);
        const stringStyle = this.getScopeStyle(args.tokenColors, 'string', 'string', args.defaultStyle);
        const variableStyle = this.getScopeStyle(args.tokenColors, 'variable', 'variable', args.defaultStyle);
        const entityTypeStyle = this.getScopeStyle(args.tokenColors, 'entity.name.type', 'entity.name.type', args.defaultStyle);

        // Use these values to fill in our format string
        return `
        :root {
            --code-comment-color: ${commentStyle.color};
            --code-numeric-color: ${numericStyle.color};
            --code-string-color: ${stringStyle.color};
            --code-variable-color: ${variableStyle.color};
            --code-type-color: ${entityTypeStyle.color};
            --code-font-family: ${args.fontFamily};
            --code-font-size: ${args.fontSize}px;
        }

        ${args.defaultStyle ? DefaultCssVars[args.defaultStyle] : undefined }
`;
    }

    // Based on this data here:
    // https://github.com/Microsoft/vscode/blob/master/src/vs/editor/standalone/common/themes.ts#L13
    private generateMonacoThemeObject(args: IApplyThemeArgs) : monacoEditor.editor.IStandaloneThemeData {
        const result: monacoEditor.editor.IStandaloneThemeData = {
            base: args.isDark ? 'vs-dark' : 'vs',
            inherit: false,
            rules: [],
            colors: {}
        };
        // If we have token colors enumerate them and add them into the rules
        if (args.tokenColors && args.tokenColors.length) {
            const tokenSet = new Set<string>();
            args.tokenColors.forEach((t: any) => {
                const scopes = this.getScopes(t);
                const settings = t && t.settings ? t.settings : undefined;
                if (scopes && settings) {
                    scopes.forEach(s => {
                        const token = s ? s.toString() : '';
                        if (!tokenSet.has(token)) {
                            tokenSet.add(token);
                            result.rules.push({
                                token,
                                foreground: settings.foreground,
                                background: settings.background,
                                fontStyle: settings.fontStyle
                            });

                            // Special case some items. punctuation.definition.comment doesn't seem to
                            // be listed anywhere. Add it manually when we find a 'comment'
                            // tslint:disable-next-line: possible-timing-attack
                            if (token === 'comment') {
                                result.rules.push({
                                    token: 'punctuation.definition.comment',
                                    foreground: settings.foreground,
                                    background: settings.background,
                                    fontStyle: settings.fontStyle
                                });
                            }

                            // Same for string
                            // tslint:disable-next-line: possible-timing-attack
                            if (token === 'string') {
                                result.rules.push({
                                    token: 'punctuation.definition.string',
                                    foreground: settings.foreground,
                                    background: settings.background,
                                    fontStyle: settings.fontStyle
                                });
                            }
                        }
                    });
                }
            });

            result.rules = result.rules.sort((a: monacoEditor.editor.ITokenThemeRule, b: monacoEditor.editor.ITokenThemeRule) => {
                return a.token.localeCompare(b.token);
            });
        } else {
            // Otherwise use our default values.
            result.base = args.defaultStyle === DarkTheme ? 'vs-dark' :  'vs';
            result.inherit = true;

            if (args.defaultStyle) {
                // Special case. We need rules for the comment beginning and the string beginning
                result.rules.push({
                    token: 'punctuation.definition.comment',
                    foreground: DefaultColors[`${args.defaultStyle}.comment`]
                });
                result.rules.push({
                    token: 'punctuation.definition.string',
                    foreground: DefaultColors[`${args.defaultStyle}.string`]
                });
            }
        }
        // If we have base colors enumerate them and add them to the colors
        if (args.baseColors) {
            const keys = Object.keys(args.baseColors);
            keys.forEach(k => {
                const color = args.baseColors && args.baseColors[k] ? args.baseColors[k] : '#000000';
                result.colors[k] = color ? color.toString() : '#000000';
            });
        } // The else case here should end up inheriting.
        return result;
    }

    private mergeColors = (colors1: JSONArray, colors2: JSONArray): JSONArray => {
        return [...colors1, ...colors2];
    }

    private mergeBaseColors = (colors1: JSONObject, colors2: JSONObject) : JSONObject => {
        return {...colors1, ...colors2};
    }

    private readTokenColors = async (themeFile: string): Promise<JSONArray> => {
        const tokenContent = await fs.readFile(themeFile, 'utf8');
        const theme = JSON.parse(stripJsonComments(tokenContent)) as JSONObject;
        const tokenColors = theme.tokenColors as JSONArray;
        if (tokenColors && tokenColors.length > 0) {
            // This theme may include others. If so we need to combine the two together
            const include = theme ? theme.include : undefined;
            if (include && include !== null) {
                const includePath = path.join(path.dirname(themeFile), include.toString());
                const includedColors = await this.readTokenColors(includePath);
                return this.mergeColors(tokenColors, includedColors);
            }

            // Theme is a root, don't need to include others
            return tokenColors;
        }

        // Might also have a 'settings' object that equates to token colors
        const settings = theme.settings as JSONArray;
        if (settings && settings.length > 0) {
            return settings;
        }

        return [];
    }

    private readBaseColors = async (themeFile: string): Promise<JSONObject> => {
        const tokenContent = await fs.readFile(themeFile, 'utf8');
        const theme = JSON.parse(stripJsonComments(tokenContent)) as JSONObject;
        const colors = theme.colors as JSONObject;

        // This theme may include others. If so we need to combine the two together
        const include = theme ? theme.include : undefined;
        if (include && include !== null) {
            const includePath = path.join(path.dirname(themeFile), include.toString());
            const includedColors = await this.readBaseColors(includePath);
            return this.mergeBaseColors(colors, includedColors);
        }

        // Theme is a root, don't need to include others
        return colors;
    }

    private findTokenColors = async (theme: string): Promise<JSONArray | null> => {

        try {
            this.logger.logInformation('Attempting search for colors ...');
            const themeRoot = await this.themeFinder.findThemeRootJson(theme);

            // Use the first result if we have one
            if (themeRoot) {
                this.logger.logInformation(`Loading colors from ${themeRoot} ...`);

                // This should be the path to the file. Load it as a json object
                const contents = await fs.readFile(themeRoot, 'utf8');
                const json = JSON.parse(stripJsonComments(contents)) as JSONObject;

                // There should be a theme colors section
                const contributes = json.contributes as JSONObject;

                // If no contributes section, see if we have a tokenColors section. This means
                // this is a direct token colors file
                if (!contributes) {
                    const tokenColors = json.tokenColors as JSONObject;
                    if (tokenColors) {
                        return await this.readTokenColors(themeRoot);
                    }
                }

                // This should have a themes section
                const themes = contributes.themes as JSONArray;

                // One of these (it's an array), should have our matching theme entry
                const index = themes.findIndex((e: any) => {
                    return e !== null && (e.id === theme || e.name === theme);
                });

                const found = index >= 0 ? themes[index] as any : null;
                if (found !== null) {
                    // Then the path entry should contain a relative path to the json file with
                    // the tokens in it
                    const themeFile = path.join(path.dirname(themeRoot), found.path);
                    this.logger.logInformation(`Reading colors from ${themeFile}`);
                    return await this.readTokenColors(themeFile);
                }
            } else {
                this.logger.logWarning(`Color theme ${theme} not found. Using default colors.`);
            }
        } catch (err) {
            // Swallow any exceptions with searching or parsing
            this.logger.logError(err);
        }

        // Force the colors to the defaults
        return null;
    }

    private findBaseColors = async (theme: string): Promise<JSONObject | null> => {
        try {
            this.logger.logInformation('Attempting search for colors ...');
            const themeRoot = await this.themeFinder.findThemeRootJson(theme);

            // Use the first result if we have one
            if (themeRoot) {
                this.logger.logInformation(`Loading base colors from ${themeRoot} ...`);

                // This should be the path to the file. Load it as a json object
                const contents = await fs.readFile(themeRoot, 'utf8');
                const json = JSON.parse(stripJsonComments(contents)) as JSONObject;

                // There should be a theme colors section
                const contributes = json.contributes as JSONObject;

                // If no contributes section, see if we have a tokenColors section. This means
                // this is a direct token colors file
                if (!contributes) {
                    return await this.readBaseColors(themeRoot);
                }

                // This should have a themes section
                const themes = contributes.themes as JSONArray;

                // One of these (it's an array), should have our matching theme entry
                const index = themes.findIndex((e: any) => {
                    return e !== null && (e.id === theme || e.name === theme);
                });

                const found = index >= 0 ? themes[index] as any : null;
                if (found !== null) {
                    // Then the path entry should contain a relative path to the json file with
                    // the tokens in it
                    const themeFile = path.join(path.dirname(themeRoot), found.path);
                    this.logger.logInformation(`Reading base colors from ${themeFile}`);
                    return await this.readBaseColors(themeFile);
                }
            } else {
                this.logger.logWarning(`Color theme ${theme} not found. Using default colors.`);
            }
        } catch (err) {
            // Swallow any exceptions with searching or parsing
            this.logger.logError(err);
        }

        // Force the colors to the defaults
        return null;
    }
}
