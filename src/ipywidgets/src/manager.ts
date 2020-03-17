// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DOMWidgetView, shims } from '@jupyter-widgets/base';
import { HTMLManager } from '@jupyter-widgets/html-manager';
import { Kernel } from '@jupyterlab/services';
import * as pWidget from '@phosphor/widgets';
import { requireLoader } from './widgetLoader';

// tslint:disable: no-any
// Source borrowed from https://github.com/jupyter-widgets/ipywidgets/blob/master/examples/web3/src/manager.ts

export class WidgetManager extends HTMLManager {
    public kernel: Kernel.IKernelConnection;
    public el: HTMLElement;
    constructor(kernel: Kernel.IKernelConnection, el: HTMLElement) {
        super({ loader: requireLoader });
        this.kernel = kernel;
        this.el = el;

        kernel.registerCommTarget(this.comm_target_name, async (comm, msg) => {
            const oldComm = new shims.services.Comm(comm);
            return this.handle_comm_open(oldComm, msg) as Promise<any>;
        });
    }

    public display_view(view: DOMWidgetView, options: { el: HTMLElement }) {
        return Promise.resolve(view).then(vw => {
            pWidget.Widget.attach(view.pWidget, options.el);
            return vw;
        });
    }

    /**
     * Create a comm.
     */
    public async _create_comm(
        target_name: string,
        model_id: string,
        data?: any,
        metadata?: any
    ): Promise<shims.services.Comm> {
        const comm = this.kernel.connectToComm(target_name, model_id);
        if (data || metadata) {
            comm.open(data, metadata);
        }
        return Promise.resolve(new shims.services.Comm(comm));
    }

    /**
     * Get the currently-registered comms.
     */
    public _get_comm_info(): Promise<any> {
        return this.kernel
            .requestCommInfo({ target: this.comm_target_name })
            .then(reply => (reply.content as any).comms);
    }
    protected loadClass(className: string, moduleName: string, moduleVersion: string): Promise<any> {
        return super
            .loadClass(className, moduleName, moduleVersion)
            .catch(() => requireLoader(moduleName, moduleVersion));
    }
}
