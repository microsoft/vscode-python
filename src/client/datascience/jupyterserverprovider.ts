// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { IJupyterServer, IJupyterServerProvider } from './types';

@injectable()
export class JupyterServerProvider implements IJupyterServerProvider {
    public start(notebookFile: string | undefined): Promise<IJupyterServer> {
        return new Promise<IJupyterServer>((resolve, reject) => {
            resolve(undefined);
        });
    }
}
