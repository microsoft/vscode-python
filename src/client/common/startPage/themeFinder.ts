// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';

import { LanguageConfiguration } from 'vscode';
import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../constants';
import { traceError } from '../logger';

import { getLanguageConfiguration } from '../../language/languageConfiguration';
import { IFileSystem } from '../platform/types';
import { ICurrentProcess, IExtensions } from '../types';
import { IThemeFinder } from './types';

// tslint:disable:no-any

interface IThemeData {
    rootFile: string;
    isDark: boolean;
}

@injectable()
export class ThemeFinder implements IThemeFinder {
    private themeCache: { [key: string]: IThemeData | undefined } = {};

    private languageCache: { [key: string]: string | undefined } = {};

    constructor(
        @inject(IExtensions) private extensions: IExtensions,
        @inject(ICurrentProcess) private currentProcess: ICurrentProcess,
        @inject(IFileSystem) private fs: IFileSystem
    ) {}

    public async findThemeRootJson(themeName: string): Promise<string | undefined> {
        // find our data
        const themeData = await this.findThemeData(themeName);

        // Use that data if it worked
        if (themeData) {
            return themeData.rootFile;
        }
    }

    public async findTmLanguage(language: string): Promise<string | undefined> {
        // See if already found it or not
        if (!this.themeCache.hasOwnProperty(language)) {
            try {
                this.languageCache[language] = await this.findMatchingLanguage(language);
            } catch (exc) {
                traceError(exc);
            }
        }
        return this.languageCache[language];
    }

    public async findLanguageConfiguration(language: string): Promise<LanguageConfiguration> {
        if (language === PYTHON_LANGUAGE) {
            // Custom for python. Some of these are required by monaco.
            const config: unknown = {
                comments: {
                    lineComment: '#',
                    blockComment: ['"""', '"""']
                },
                brackets: [
                    ['{', '}'],
                    ['[', ']'],
                    ['(', ')']
                ],
                autoClosingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"', notIn: ['string'] },
                    { open: "'", close: "'", notIn: ['string', 'comment'] }
                ],
                surroundingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" }
                ],
                folding: {
                    offSide: true,
                    markers: {
                        start: new RegExp('^\\s*#region\\b'),
                        end: new RegExp('^\\s*#endregion\\b')
                    }
                },
                ...getLanguageConfiguration()
            };

            return config as LanguageConfiguration;
        }
        return this.findMatchingLanguageConfiguration(language);
    }

    public async isThemeDark(themeName: string): Promise<boolean | undefined> {
        // find our data
        const themeData = await this.findThemeData(themeName);

        // Use that data if it worked
        if (themeData) {
            return themeData.isDark;
        }
    }

    private async findThemeData(themeName: string): Promise<IThemeData | undefined> {
        // See if already found it or not
        if (!this.themeCache.hasOwnProperty(themeName)) {
            try {
                this.themeCache[themeName] = await this.findMatchingTheme(themeName);
            } catch (exc) {
                traceError(exc);
            }
        }
        return this.themeCache[themeName];
    }

    private async findMatchingLanguage(language: string): Promise<string | undefined> {
        const currentExe = this.currentProcess.execPath;
        let currentPath = path.dirname(currentExe);

        // Should be somewhere under currentPath/resources/app/extensions inside of a json file
        let extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions');
        if (!(await this.fs.directoryExists(extensionsPath))) {
            // Might be on mac or linux. try a different path
            currentPath = path.resolve(currentPath, '../../../..');
            extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions');
        }

        // Search through all of the files in this folder
        let results = await this.findMatchingLanguages(language, extensionsPath);

        // If that didn't work, see if it's our MagicPython predefined tmLanguage
        if (!results && language === PYTHON_LANGUAGE) {
            results = await this.fs.readFile(path.join(EXTENSION_ROOT_DIR, 'resources', 'MagicPython.tmLanguage.json'));
        }

        return results;
    }

    private async findMatchingLanguageConfiguration(language: string): Promise<LanguageConfiguration> {
        try {
            const currentExe = this.currentProcess.execPath;
            let currentPath = path.dirname(currentExe);

            // Should be somewhere under currentPath/resources/app/extensions inside of a json file
            let extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions', language);
            if (!(await this.fs.directoryExists(extensionsPath))) {
                // Might be on mac or linux. try a different path
                currentPath = path.resolve(currentPath, '../../../..');
                extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions', language);
            }

            // See if the 'language-configuration.json' file exists
            const filePath = path.join(extensionsPath, 'language-configuration.json');
            if (await this.fs.fileExists(filePath)) {
                const contents = await this.fs.readFile(filePath);
                return JSON.parse(contents) as LanguageConfiguration;
            }
        } catch {
            // Do nothing if an error
        }

        return {};
    }

    private async findMatchingLanguages(language: string, rootPath: string): Promise<string | undefined> {
        // Environment variable to mimic missing json problem
        if (process.env.VSC_PYTHON_MIMIC_REMOTE) {
            return undefined;
        }

        // Search through all package.json files in the directory and below, looking
        // for the themeName in them.
        const foundPackages = await this.fs.search('**/package.json', rootPath);
        if (foundPackages && foundPackages.length > 0) {
            // For each one, open it up and look for the theme name.
            for (const f of foundPackages) {
                const fpath = path.join(rootPath, f);
                const data = await this.findMatchingLanguageFromJson(fpath, language);
                if (data) {
                    return data;
                }
            }
        }
    }

    private async findMatchingTheme(themeName: string): Promise<IThemeData | undefined> {
        // Environment variable to mimic missing json problem
        if (process.env.VSC_PYTHON_MIMIC_REMOTE) {
            return undefined;
        }

        // Look through all extensions to find the theme. This will search
        // the default extensions folder and our installed extensions.
        const extensions = this.extensions.all;
        for (const e of extensions) {
            const result = await this.findMatchingThemeFromJson(path.join(e.extensionPath, 'package.json'), themeName);
            if (result) {
                return result;
            }
        }

        // If didn't find in the extensions folder, then try searching manually. This shouldn't happen, but
        // this is our backup plan in case vscode changes stuff.
        const currentExe = this.currentProcess.execPath;
        let currentPath = path.dirname(currentExe);

        // Should be somewhere under currentPath/resources/app/extensions inside of a json file
        let extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions');
        if (!(await this.fs.directoryExists(extensionsPath))) {
            // Might be on mac or linux. try a different path
            currentPath = path.resolve(currentPath, '../../../..');
            extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions');
        }
        const other = await this.findMatchingThemes(extensionsPath, themeName);
        if (other) {
            return other;
        }
    }

    private async findMatchingThemes(rootPath: string, themeName: string): Promise<IThemeData | undefined> {
        // Search through all package.json files in the directory and below, looking
        // for the themeName in them.
        const foundPackages = await this.fs.search('**/package.json', rootPath);
        if (foundPackages && foundPackages.length > 0) {
            // For each one, open it up and look for the theme name.
            for (const f of foundPackages) {
                const fpath = path.join(rootPath, f);
                const data = await this.findMatchingThemeFromJson(fpath, themeName);
                if (data) {
                    return data;
                }
            }
        }
    }

    private async findMatchingLanguageFromJson(packageJson: string, language: string): Promise<string | undefined> {
        // Read the contents of the json file
        const text = await this.fs.readFile(packageJson);
        const json = JSON.parse(text);

        // Should have a name entry and a contributes entry
        if (json.hasOwnProperty('name') && json.hasOwnProperty('contributes')) {
            // See if contributes has a grammars
            const { contributes } = json;
            if (contributes.hasOwnProperty('grammars')) {
                const grammars = contributes.grammars as any[];
                // Go through each theme, seeing if the label matches our theme name
                for (const t of grammars) {
                    if (t.hasOwnProperty('language') && t.language === language) {
                        // Path is relative to the package.json file.
                        const rootFile = t.hasOwnProperty('path')
                            ? path.join(path.dirname(packageJson), t.path.toString())
                            : '';
                        return this.fs.readFile(rootFile);
                    }
                }
            }
        }
    }

    private async findMatchingThemeFromJson(packageJson: string, themeName: string): Promise<IThemeData | undefined> {
        // Read the contents of the json file
        const text = await this.fs.readFile(packageJson);
        const json = JSON.parse(text);

        // Should have a name entry and a contributes entry
        if (json.hasOwnProperty('name') && json.hasOwnProperty('contributes')) {
            // See if contributes has a theme
            const { contributes } = json;
            if (contributes.hasOwnProperty('themes')) {
                const themes = contributes.themes as any[];
                // Go through each theme, seeing if the label matches our theme name
                for (const t of themes) {
                    if (
                        (t.hasOwnProperty('label') && t.label === themeName) ||
                        (t.hasOwnProperty('id') && t.id === themeName)
                    ) {
                        const isDark = t.hasOwnProperty('uiTheme') && t.uiTheme === 'vs-dark';
                        // Path is relative to the package.json file.
                        const rootFile = t.hasOwnProperty('path')
                            ? path.join(path.dirname(packageJson), t.path.toString())
                            : '';

                        return { isDark, rootFile };
                    }
                }
            }
        }
    }
}
