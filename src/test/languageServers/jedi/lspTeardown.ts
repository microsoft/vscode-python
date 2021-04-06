// Licensed under the MIT License.

import * as fs from 'fs-extra';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';

// Put back the package json
const packageJsonPath = path.join(EXTENSION_ROOT_DIR, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
packageJson.contributes.configuration.properties['python.experiments.optInto'].scope = 'machine';
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, undefined, ' '));

// Rewrite settings json so we're not overriding the experiment values
const settingsJsonPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'test', '.vscode', 'settings.json');
const settingsJsonPromise = import('../../.vscode/settings.json');

settingsJsonPromise.then((settingsJson) =>
    fs.writeFile(settingsJsonPath, JSON.stringify(settingsJson, undefined, ' ')),
);
