// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IDataScienceSettings } from '../../client/common/types';

// The WebPanel constructed by the extension should inject a getInitialSettings function into
// the script. This should return a dictionary of key value pairs for settings
export declare function getInitialSettings(): any;

let loadedSettings: IDataScienceSettings | undefined;

export function getSettings() : IDataScienceSettings {
    if (loadedSettings === undefined) {
        load();
    }

    return loadedSettings;
}

export function updateSettings(jsonSettingsString: string) {
    const newSettings = JSON.parse(jsonSettingsString);
    let dsSettings: IDataScienceSettings = <IDataScienceSettings>newSettings;
    loadedSettings = dsSettings;
}

function load() {
    // tslint:disable-next-line:no-typeof-undefined
    if (typeof getInitialSettings !== 'undefined') {
        loadedSettings = <IDataScienceSettings>getInitialSettings();
    } else {
        // Default settings for tests
        loadedSettings = {
            allowImportFromNotebook: true,
            jupyterLaunchTimeout: 10,
            enabled: true,
            jupyterServerURI: 'local',
            notebookFileRoot: 'WORKSPACE',
            changeDirOnImportExport: true,
            useDefaultConfigForJupyter: true,
            jupyterInterruptTimeout: 10000,
            searchForJupyter: true,
            showCellInputCode: true,
            collapseCellInputCode: true
        };
    }
}
