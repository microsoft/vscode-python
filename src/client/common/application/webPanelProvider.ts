// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { IServiceContainer } from '../../ioc/types';
import { IWebPanel, IWebPanelMessageListener, IWebPanelProvider } from './types';
import { WebPanel } from './webPanel';

@injectable()
export class WebPanelProvider implements IWebPanelProvider {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    }

    // tslint:disable-next-line:no-any
    public create(listener: IWebPanelMessageListener, title: string, mainScriptPath: string, embeddedCss?: string, settings?: any) : IWebPanel {
        return new WebPanel(this.serviceContainer, listener, title, mainScriptPath, embeddedCss, settings);
    }
}
