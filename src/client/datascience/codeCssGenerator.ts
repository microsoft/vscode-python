// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { JSONArray, JSONObject, JSONValue } from '@phosphor/coreutils';
import * as fm from 'file-matcher';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';

import { IWorkspaceService } from '../common/application/types';
import { ICurrentProcess, ILogger } from '../common/types';
import { ICodeCssGenerator } from './types';

// This class generates css using the current theme in order to colorize code.
//
// NOTE: This is all a big hack. It's relying on the theme json files to have a certain format
// in order for this to work.
// See this vscode issue for the real way we think this should happen:
// https://github.com/Microsoft/vscode/issues/32813
@injectable()
export class CodeCssGenerator implements ICodeCssGenerator {
    constructor(
        @inject(IWorkspaceService) private workspaceService : IWorkspaceService,
        @inject(ICurrentProcess) private currentProcess : ICurrentProcess,
        @inject(ILogger) private logger : ILogger) {
    }

    public generateThemeCss = async () : Promise<string> => {
        try {
            // First compute our current theme.
            const workbench = this.workspaceService.getConfiguration('workbench');
            const theme = workbench.get<string>('colorTheme');
            const editor = this.workspaceService.getConfiguration('editor', undefined);
            const font = editor.get<string>('fontFamily');
            const fontSize = editor.get<number>('fontSize');

            // Then we have to find where the theme resources are loaded from
            if (theme) {
                const tokenColors = await this.findTokenColors(theme);

                // The tokens object then contains the necessary data to generate our css
                if (tokenColors && font && fontSize) {
                    return this.generateCss(tokenColors, font, fontSize);
                }
            }
        } catch (err) {
            // On error don't fail, just log
            this.logger.logError(err);
        }

        return '';
    }

    private getScopeColor = (tokenColors: JSONArray, scope: string) : string => {
        // Search through the scopes on the json object
        const match = tokenColors.findIndex(entry => {
            if (entry) {
                const scopes = entry['scope'] as JSONValue;
                if (scopes && Array.isArray(scopes)) {
                    if (scopes.find(v => v !== null && v.toString() === scope)) {
                        return true;
                    }
                } else if (scopes && scopes.toString() === scope) {
                    return true;
                }
            }

            return false;
        });

        const found = match >= 0 ? tokenColors[match] : null;
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
    private generateCss = (tokenColors : JSONArray, fontFamily : string, fontSize: number) : string => {

        // There's a set of values that need to be found
        const comment = this.getScopeColor(tokenColors, 'comment');
        const numeric = this.getScopeColor(tokenColors, 'constant.numeric');
        const stringColor = this.getScopeColor(tokenColors, 'string');
        const keyword = this.getScopeColor(tokenColors, 'keyword');
        const operator = this.getScopeColor(tokenColors, 'keyword.operator');
        const variable = this.getScopeColor(tokenColors, 'variable');
        const def = 'var(--vscode-editor-foreground)';

        // Use these values to fill in our format string
        return `
        code[class*="language-"],
        pre[class*="language-"] {
            color: ${def};
            background: none;
            text-shadow: none;
            font-family: ${fontFamily};
            text-align: left;
            white-space: pre;
            word-spacing: normal;
            word-break: normal;
            word-wrap: normal;
            font-size: ${fontSize}px;

            -moz-tab-size: 4;
            -o-tab-size: 4;
            tab-size: 4;

            -webkit-hyphens: none;
            -moz-hyphens: none;
            -ms-hyphens: none;
            hyphens: none;
        }

        pre[class*="language-"]::-moz-selection, pre[class*="language-"] ::-moz-selection,
        code[class*="language-"]::-moz-selection, code[class*="language-"] ::-moz-selection {
            text-shadow: none;
            background: var(--vscode-editor-selectionBackground);
        }

        pre[class*="language-"]::selection, pre[class*="language-"] ::selection,
        code[class*="language-"]::selection, code[class*="language-"] ::selection {
            text-shadow: none;
            background: var(--vscode-editor-selectionBackground);
        }

        @media print {
            code[class*="language-"],
            pre[class*="language-"] {
                text-shadow: none;
            }
        }

        /* Code blocks */
        pre[class*="language-"] {
            padding: 1em;
            margin: .5em 0;
            overflow: auto;
        }

        :not(pre) > code[class*="language-"],
        pre[class*="language-"] {
            background: transparent;
        }

        /* Inline code */
        :not(pre) > code[class*="language-"] {
            padding: .1em;
            border-radius: .3em;
            white-space: normal;
        }

        .token.comment,
        .token.prolog,
        .token.doctype,
        .token.cdata {
            color: ${comment};
        }

        .token.punctuation {
            color: ${def};
        }

        .namespace {
            opacity: .7;
        }

        .token.property,
        .token.tag,
        .token.boolean,
        .token.number,
        .token.constant,
        .token.symbol,
        .token.deleted {
            color: ${numeric};
        }

        .token.selector,
        .token.attr-name,
        .token.string,
        .token.char,
        .token.builtin,
        .token.inserted {
            color: ${stringColor};
        }

        .token.operator,
        .token.entity,
        .token.url,
        .language-css .token.string,
        .style .token.string {
            color: ${operator};
            background: transparent;
        }

        .token.atrule,
        .token.attr-value,
        .token.keyword {
            color: ${keyword};
        }

        .token.function,
        .token.class-name {
            color: ${keyword};
        }

        .token.regex,
        .token.important,
        .token.variable {
            color: ${variable};
        }

        .token.important,
        .token.bold {
            font-weight: bold;
        }
        .token.italic {
            font-style: italic;
        }

        .token.entity {
            cursor: help;
        }
`;

    }

    private mergeColors = (colors1 : JSONArray, colors2 : JSONArray) : JSONArray => {
        return [...colors1, ...colors2];
    }

    private readTokenColors = async (themeFile: string) : Promise<JSONArray> => {
        const tokenContent = await fs.readFile(themeFile, 'utf8');
        const theme = JSON.parse(tokenContent) as JSONObject;
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

    private findTokenColors = async (theme : string) : Promise<JSONArray> => {
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
        const escapedThemeName = theme.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const searchOptions : fm.FindOptions = {
            path: extensionsPath,
            recursiveSearch: true,
            fileFilter : {
                fileNamePattern : '**/*.json',
                content: new RegExp(`id[',"]:\\s*[',"]${escapedThemeName}[',"]`)
            }
        };

        const matcher = new fm.FileMatcher();

        try {
            const results = await matcher.find(searchOptions);

            // Use the first result if we have one
            if (results && results.length > 0) {
                // This should be the path to the file. Load it as a json object
                const contents = await fs.readFile(results[0], 'utf8');
                const json = JSON.parse(contents) as JSONObject;

                // There should be a contributes section
                const contributes = json['contributes'] as JSONObject;

                // This should have a themes section
                const themes = contributes['themes'] as JSONArray;

                // One of these (it's an array), should have our matching theme entry
                const index = themes.findIndex(e => {
                    return e !== null && e['id'] === theme;
                });

                const found = index >= 0 ? themes[index] : null;
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
        const defaultThemeFile = path.join(__dirname, 'defaultTheme.json');
        return this.readTokenColors(defaultThemeFile);
    }
}
