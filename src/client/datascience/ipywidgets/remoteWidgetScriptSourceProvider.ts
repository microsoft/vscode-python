// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IConnection } from '../types';
import { IWidgetScriptSourceProvider, WidgetScriptSource } from './types';

/**
 * When using a remote jupyter connection the widget scripts are accessible over
 * `<remote url>/nbextensions/moduleName/index`
 */
export class RemoteWidgetScriptSourceProvider implements IWidgetScriptSourceProvider {
    constructor(private readonly connection: IConnection) {}
    public dispose() {
        // Noop.
    }
    public async getWidgetScriptSource(moduleName: string): Promise<WidgetScriptSource> {
        return { moduleName, scriptUri: `${this.connection.baseUrl}/nbextensions/${moduleName}/index` };
    }
}
