// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { JSONArray, JSONObject, JSONValue } from '@phosphor/coreutils';
import { FindOptions } from 'file-matcher';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as stripJsonComments from 'strip-json-comments';

import { IWorkspaceService } from '../common/application/types';
import { ICurrentProcess, ILogger } from '../common/types';
import { EXTENSION_ROOT_DIR } from '../constants';
import { Identifiers } from './constants';
import { ICodeCssGenerator } from './types';

// tslint:disable:no-any

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
        @inject(ICurrentProcess) private currentProcess: ICurrentProcess,
        @inject(ILogger) private logger: ILogger) {
    }

    public generateThemeCss = async (): Promise<string> => {
        try {
            // First compute our current theme.
            const workbench = this.workspaceService.getConfiguration('workbench');
            const theme = workbench.get<string>('colorTheme');
            const terminalCursor = workbench.get<string>('terminal.integrated.cursorStyle', 'block');
            const editor = this.workspaceService.getConfiguration('editor', undefined);
            const font = editor.get<string>('fontFamily');
            const fontSize = editor.get<number>('fontSize');

            // Then we have to find where the theme resources are loaded from
            if (theme) {
                const tokenColors = await this.findTokenColors(theme);

                // The tokens object then contains the necessary data to generate our css
                if (tokenColors && font && fontSize) {
                    return this.generateCss(theme, tokenColors, font, fontSize, terminalCursor);
                }
            }
        } catch (err) {
            // On error don't fail, just log
            this.logger.logError(err);
        }

        return '';
    }

    private escapeThemeName(themeName: string) : string {
        return themeName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    private matchTokenColor(tokenColors: JSONArray, scope: string) : number {
        return tokenColors.findIndex((entry: any) => {
            if (entry) {
                const scopes = entry['scope'] as JSONValue;
                if (scopes && Array.isArray(scopes)) {
                    if (scopes.find(v => v !== null && v !== undefined && v.toString() === scope)) {
                        return true;
                    }
                } else if (scopes && scopes.toString() === scope) {
                    return true;
                }
            }

            return false;
        });
    }

    private getScopeColor = (tokenColors: JSONArray, scope: string, secondary?: string): string => {
        // Search through the scopes on the json object
        let match = this.matchTokenColor(tokenColors, scope);
        if (match < 0 && secondary) {
            match = this.matchTokenColor(tokenColors, secondary);
        }
        const found = match >= 0 ? tokenColors[match] as any : null;
        if (found !== null) {
            const settings = found['settings'];
            if (settings && settings !== null) {
                return settings['foreground'];
            }
        }

        // Default to editor foreground
        return 'var(--vscode-editor-foreground)';
    }

    // tslint:disable-next-line:max-func-body-length
    private generateCss(theme: string, tokenColors: JSONArray, fontFamily: string, fontSize: number, cursorType: string): string {
        const escapedThemeName = Identifiers.GeneratedThemeName;

        // There's a set of values that need to be found
        const comment = this.getScopeColor(tokenColors, 'comment');
        const numeric = this.getScopeColor(tokenColors, 'constant.numeric');
        const stringColor = this.getScopeColor(tokenColors, 'string');
        const keyword = this.getScopeColor(tokenColors, 'keyword.control', 'keyword');
        const operator = this.getScopeColor(tokenColors, 'keyword.operator');
        const variable = this.getScopeColor(tokenColors, 'variable');
        // const atomic = this.getScopeColor(tokenColors, 'atomic');
        const builtin = this.getScopeColor(tokenColors, 'support.function');
        const punctuation = this.getScopeColor(tokenColors, 'punctuation');

        const def = 'var(--vscode-editor-foreground)';

        // Define our cursor style based on the cursor type
        const cursorStyle = cursorType === 'block' ?
            `{ border: 1px solid ${def}; background: ${def}; width: 5px; z-index=100; }` : cursorType === 'underline' ?
            `{ border-bottom: 1px solid ${def}; z-index=100; width: 5px; }` :
            `{ border-left: 1px solid ${def}; border-right: none; z-index=100; }`;

        // Use these values to fill in our format string
        return `
        :root {
            --code-comment-color: ${comment};
            --code-font-family: ${fontFamily};
            --code-font-size:${fontSize}px;
        }
        .cm-header, .cm-strong {font-weight: bold;}
        .cm-em {font-style: italic;}
        .cm-link {text-decoration: underline;}
        .cm-strikethrough {text-decoration: line-through;}

        .cm-s-${escapedThemeName} span.cm-keyword {color: ${keyword};}
        .cm-s-${escapedThemeName} span.cm-number {color: ${numeric};}
        .cm-s-${escapedThemeName} span.cm-def {color: ${def};}
        .cm-s-${escapedThemeName} span.cm-variable {color: ${variable};}
        .cm-s-${escapedThemeName} span.cm-punctuation {color: ${punctuation};}
        .cm-s-${escapedThemeName} span.cm-property,
        .cm-s-${escapedThemeName} span.cm-operator {color: ${operator};}
        .cm-s-${escapedThemeName} span.cm-variable-2 {color: ${variable};}
        .cm-s-${escapedThemeName} span.cm-variable-3, .cm-s-${theme} .cm-type {color: ${variable};}
        .cm-s-${escapedThemeName} span.cm-comment {color: ${comment};}
        .cm-s-${escapedThemeName} span.cm-string {color: ${stringColor};}
        .cm-s-${escapedThemeName} span.cm-string-2 {color: ${stringColor};}
        .cm-s-${escapedThemeName} span.cm-builtin {color: ${builtin};}
        .cm-s-${escapedThemeName} div.CodeMirror-cursor ${cursorStyle}
        .cm-s-${escapedThemeName} div.CodeMirror-selected {background: var(--vscode-editor-selectionBackground) !important;}
`;

    }

    private mergeColors = (colors1: JSONArray, colors2: JSONArray): JSONArray => {
        return [...colors1, ...colors2];
    }

    private readTokenColors = async (themeFile: string): Promise<JSONArray> => {
        const tokenContent = await fs.readFile(themeFile, 'utf8');
        const theme = JSON.parse(stripJsonComments(tokenContent)) as JSONObject;
        const tokenColors = theme['tokenColors'] as JSONArray;
        if (tokenColors && tokenColors.length > 0) {
            // This theme may include others. If so we need to combine the two together
            const include = theme ? theme['include'] : undefined;
            if (include && include !== null) {
                const includePath = path.join(path.dirname(themeFile), include.toString());
                const includedColors = await this.readTokenColors(includePath);
                return this.mergeColors(tokenColors, includedColors);
            }

            // Theme is a root, don't need to include others
            return tokenColors;
        }

        return [];
    }

    private findTokenColors = async (theme: string): Promise<JSONArray> => {
        const currentExe = this.currentProcess.execPath;
        let currentPath = path.dirname(currentExe);

        // Should be somewhere under currentPath/resources/app/extensions inside of a json file
        let extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions');
        if (!(await fs.pathExists(extensionsPath))) {
            // Might be on mac or linux. try a different path
            currentPath = path.resolve(currentPath, '../../../..');
            extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions');
        }

        // Search through all of the json files for the theme name
        const escapedThemeName = this.escapeThemeName(theme);
        const searchOptions: FindOptions = {
            path: extensionsPath,
            recursiveSearch: true,
            fileFilter: {
                fileNamePattern: '**/*.json',
                content: new RegExp(`[name|id][',"]:\\s*[',"]${escapedThemeName}[',"]`)
            }
        };
        // tslint:disable-next-line:no-require-imports
        const fm = require('file-matcher') as typeof import('file-matcher');
        const matcher = new fm.FileMatcher();

        try {
            const results = await matcher.find(searchOptions);

            // Use the first result if we have one
            if (results && results.length > 0) {
                // This should be the path to the file. Load it as a json object
                const contents = await fs.readFile(results[0], 'utf8');
                const json = JSON.parse(stripJsonComments(contents)) as JSONObject;

                // There should be a theme colors section
                const contributes = json['contributes'] as JSONObject;

                // If no contributes section, see if we have a tokenColors section. This means
                // this is a direct token colors file
                if (!contributes) {
                    const tokenColors = json['tokenColors'] as JSONObject;
                    if (tokenColors) {
                        return await this.readTokenColors(results[0]);
                    }
                }

                // This should have a themes section
                const themes = contributes['themes'] as JSONArray;

                // One of these (it's an array), should have our matching theme entry
                const index = themes.findIndex((e: any) => {
                    return e !== null && e['id'] === theme;
                });

                const found = index >= 0 ? themes[index] as any : null;
                if (found !== null) {
                    // Then the path entry should contain a relative path to the json file with
                    // the tokens in it
                    const themeFile = path.join(path.dirname(results[0]), found['path']);
                    return await this.readTokenColors(themeFile);
                }
            }
        } catch (err) {
            // Swallow any exceptions with searching or parsing
            this.logger.logError(err);
        }

        // We should return a default. The vscode-light theme
        const defaultThemeFile = path.join(EXTENSION_ROOT_DIR, 'resources', 'defaultTheme.json');
        return this.readTokenColors(defaultThemeFile);
    }
}
