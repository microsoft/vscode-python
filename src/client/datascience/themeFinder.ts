// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import { inject, injectable } from 'inversify';
import * as path from 'path';

import { ICurrentProcess, IExtensions, ILogger } from '../common/types';

// tslint:disable:no-any

interface IThemeData {
    rootFile: string;
    isDark : boolean;
}

@injectable()
export class ThemeFinder {
    private themeCache : { [key: string] : IThemeData | undefined } = {};

    constructor(
        @inject(IExtensions) private extensions: IExtensions,
        @inject(ICurrentProcess) private currentProcess: ICurrentProcess,
        @inject(ILogger) private logger: ILogger) {
    }

    public async findThemeRootJson(themeName: string) : Promise<string | undefined> {
        // find our data
        const themeData = await this.findThemeData(themeName);

        // Use that data if it worked
        if (themeData) {
            return themeData.rootFile;
        }
    }

    public async isThemeDark(themeName: string) : Promise<boolean | undefined> {
        // find our data
        const themeData = await this.findThemeData(themeName);

        // Use that data if it worked
        if (themeData) {
            return themeData.isDark;
        }
    }

    private async findThemeData(themeName: string) : Promise<IThemeData | undefined> {
        // See if already found it or not
        if (!this.themeCache.hasOwnProperty(themeName)) {
            try {
                this.themeCache[themeName] = await this.findMatchingTheme(themeName);
            } catch (exc) {
                this.logger.logError(exc);
            }
        }
        return this.themeCache[themeName];
    }

    private async findMatchingTheme(themeName: string) : Promise<IThemeData | undefined> {
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
        if (!(await fs.pathExists(extensionsPath))) {
            // Might be on mac or linux. try a different path
            currentPath = path.resolve(currentPath, '../../../..');
            extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions');
        }
        const other = await this.findMatchingThemes(extensionsPath, themeName);
        if (other) {
            return other;
        }
    }

    private async findMatchingThemes(rootPath: string, themeName: string) : Promise<IThemeData | undefined> {
        // Search through all package.json files in the directory and below, looking
        // for the themeName in them.
        const foundPackages = await new Promise<string []>((resolve, reject) => {
            glob('**/package.json', { cwd: rootPath }, (err, matches) => {
                if (err) {
                    reject(err);
                }
                resolve(matches);
            });
        });
        if (foundPackages.length > 0) {
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

    private async findMatchingThemeFromJson(packageJson: string, themeName: string) : Promise<IThemeData | undefined> {
        // Read the contents of the json file
        const json = await fs.readJSON(packageJson, { encoding: 'utf-8'});

        // Should have a name entry and a contributes entry
        if (json.hasOwnProperty('name') && json.hasOwnProperty('contributes')) {
            // See if contributes has a theme
            const contributes = json['contributes'];
            if (contributes.hasOwnProperty('themes')) {
                const themes = contributes['themes'] as any[];
                // Go through each theme, seeing if the label matches our theme name
                for (const t of themes) {
                    if ((t.hasOwnProperty('label') && t['label'] === themeName) ||
                        (t.hasOwnProperty('id') && t['id'] === themeName)) {
                        const isDark = t.hasOwnProperty('uiTheme') && t['uiTheme'] === 'vs-dark';
                        // Path is relative to the package.json file.
                        const rootFile = t.hasOwnProperty('path') ? path.join(path.dirname(packageJson), t['path'].toString()) : '';

                        return {isDark, rootFile};
                    }
                }
            }
        }
    }
}
