// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { setSharedProperty } from '.';
import { IFileSystem } from '../common/platform/types';
import { EXTENSION_ROOT_DIR } from '../constants';

/**
 * Sets shared telemetry property about where the extension was installed from
 * currently we only detect installations from the Python coding pack installer.
 * Those installations get the 'pythonCodingPack'. Otherwise assume the default
 * case as 'MarketPlace'.
 *
 */
export async function setExtensionInstallTelemetryProperties(fs: IFileSystem) {
    // Look for PythonCodingPack file under `%USERPROFILE%/.vscode/extensions`
    // folder. If that file exists treat this extension as installed from coding
    // pack.
    //
    // Use parent of EXTENSION_ROOT_DIR to access %USERPROFILE%/.vscode/extensions
    // If you use join (%USERPROFILE%, .vscode, extensions), then if user has both
    // ~/.vscode and ~./vscode-insiders, and launches Python extension via VS Code
    // insiders, it will look for ~/.vscode/extensions/PythonCodingPack which is
    // wrong. This is a rare scenario, and it can be easily avoided by using parent
    // of EXTENSION_ROOT_DIR. Ii you use EXTENSION_ROOT_DIR then, in the case of
    // VS Code insiders it will be, ~/.vscode-insiders/extensions/. That folder will
    // NOT have PythonCodingPack file and we can treat the insiders case as MarkerPlace.
    const fileToCheck = path.join(path.dirname(EXTENSION_ROOT_DIR), 'PythonCodingPack');
    if (await fs.fileExists(fileToCheck)) {
        setSharedProperty('installSource', 'pythonCodingPack');
    } else {
        // We did not file the `PythonCodingPack` file, assume market place install.
        setSharedProperty('installSource', 'marketPlace');
    }
}
