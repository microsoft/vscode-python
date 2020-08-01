// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as path from 'path';

import { EXTENSION_ROOT_DIR } from '../../constants';
import { IDataScienceFileSystem, IJupyterVariable } from '../types';

export class VariableScriptLoader {
    private fetchVariableShapeScript?: string;
    private filesLoaded: boolean = false;

    constructor(private fs: IDataScienceFileSystem) {}

    public readShapeScript(targetVariable: IJupyterVariable): Promise<string | undefined> {
        return this.readScript(targetVariable, () => this.fetchVariableShapeScript);
    }

    private async readScript(
        targetVariable: IJupyterVariable | undefined,
        scriptBaseTextFetcher: () => string | undefined,
        extraReplacements: { key: string; value: string }[] = []
    ): Promise<string | undefined> {
        if (!this.filesLoaded) {
            await this.loadVariableFiles();
        }

        const scriptBaseText = scriptBaseTextFetcher();

        // Prep our targetVariable to send over. Remove the 'value' as it's not necessary for getting df info and can have invalid data in it
        const pruned = { ...targetVariable, value: '' };
        const variableString = JSON.stringify(pruned);

        // Setup a regex
        const regexPattern =
            extraReplacements.length === 0
                ? '_VSCode_JupyterTestValue'
                : ['_VSCode_JupyterTestValue', ...extraReplacements.map((v) => v.key)].join('|');
        const replaceRegex = new RegExp(regexPattern, 'g');

        // Replace the test value with our current value. Replace start and end as well
        return scriptBaseText
            ? scriptBaseText.replace(replaceRegex, (match: string) => {
                  if (match === '_VSCode_JupyterTestValue') {
                      return variableString;
                  } else {
                      const index = extraReplacements.findIndex((v) => v.key === match);
                      if (index >= 0) {
                          return extraReplacements[index].value;
                      }
                  }

                  return match;
              })
            : undefined;
    }

    // Load our python files for fetching variables
    private async loadVariableFiles(): Promise<void> {
        const file = path.join(
            EXTENSION_ROOT_DIR,
            'pythonFiles',
            'vscode_datascience_helpers',
            'getJupyterVariableShape.py'
        );
        this.fetchVariableShapeScript = await this.fs.readLocalFile(file);
        this.filesLoaded = true;
    }
}
