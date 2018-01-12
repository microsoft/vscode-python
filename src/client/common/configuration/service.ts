// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { PythonSettings } from '../configSettings';
import { IConfigurationService, IPythonSettings } from '../types';

@injectable()
export class ConfigurationService implements IConfigurationService {
    public getSettings(resource?: Uri): IPythonSettings {
        return PythonSettings.getInstance(resource);
    }
}
