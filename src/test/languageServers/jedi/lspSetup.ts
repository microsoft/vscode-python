// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-extra';
import * as path from 'path';
import { JediLSP } from '../../../client/common/experiments/groups';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';

// Modify package.json so that it allows workspace based experiment settings
const packageJsonPath = path.join(EXTENSION_ROOT_DIR, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
packageJson.contributes.configuration.properties['python.experiments.optInto'].scope = 'resource';
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, undefined, ' '));

// Modify settings.json so that it turns on the LSP experiment
const settingsJsonPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'test', '.vscode', 'settings.json');
const settingsJsonPromise = import('../../.vscode/settings.json');

settingsJsonPromise.then((settingsJson) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<any>settingsJson)['python.experiments.optInto'] = [JediLSP.experiment];
    return fs.writeFile(settingsJsonPath, JSON.stringify(settingsJson, undefined, ' '));
});
