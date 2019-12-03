// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, QuickPickItem } from 'vscode';
import { IInterpreterSelector } from '../../../interpreter/configuration/types';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IJupyterKernelSpec, IJupyterSessionManager } from '../../types';
import { KernelService } from './kernelService';

export interface IKernelSpecQuickPickItem extends QuickPickItem {
    selection: { kernelSpec: IJupyterKernelSpec } | { interpreter: PythonInterpreter };
}

function getQuickPickFromKernelSpec(kernelSpec: IJupyterKernelSpec): IKernelSpecQuickPickItem {
    return {
        label: kernelSpec.display_name || kernelSpec.name || '',
        description: '',
        selection: { kernelSpec: kernelSpec }
    };
}
export interface IKernelSelector {
    selectKernelSpec(cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined>;
}

// export class kernelSelector implements IKernelSelector {
//     public async selectKernelSpec(session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {
//         return;
//     }
//     private selectKernelSpecFromList(session?: IJupyterSessionManager, cancelToken?: CancellationToken): Promise<IJupyterKernelSpec | undefined> {}
// }

export interface IKernelSelectionListProvider {
    getKernelSelections(cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]>;
}


@injectable()
export class KernelSelectionProviderFactory {
    constructor(@inject(KernelService) private readonly kernelService: KernelService, @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector) {}
    public async getRemoteKernelSelectionProvider(session: IJupyterSessionManager): Promise<IKernelSelectionListProvider> {
        // tslint:disable: no-use-before-declare
        return new RemoteKernelSelectionProvider(session);
    }
    public async getLocalKernelSelectionProvider(session?: IJupyterSessionManager): Promise<IKernelSelectionListProvider> {
        return new LocalKernelSelectionProvider(this.kernelService, this.interpreterSelector, session);
    }
}
export class RemoteKernelSelectionProvider implements IKernelSelectionListProvider {
    constructor(private readonly session: IJupyterSessionManager) {}
    public async getKernelSelections(cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]> {
        return new JupyterSessionKernelSelectionnListProvider(this.session).getKernelSelections(cancelToken);
    }
}

// tslint:disable: max-classes-per-file
export class LocalKernelSelectionProvider implements IKernelSelectionListProvider {
    constructor(private readonly kernelService: KernelService, private readonly interpreterSelector: IInterpreterSelector, private readonly session?: IJupyterSessionManager) {}
    public async getKernelSelections(cancelToken?: CancellationToken): Promise<IKernelSpecQuickPickItem[]> {
        const activeKernelsPromise = this.session ? new JupyterSessionKernelSelectionnListProvider(this.session).getKernelSelections(cancelToken) : Promise.resolve([]);
        const jupyterKernelsPromise = new JupyterKernelSelectionnListProvider(this.kernelService).getKernelSelections(cancelToken);
        const interpretersPromise = new InterpreterKernelSelectionnListProvider(this.interpreterSelector).getKernelSelections(cancelToken);
        const [activeKernels, jupyterKernels, interprters] = await Promise.all([activeKernelsPromise, jupyterKernelsPromise, interpretersPromise]);
        return [...activeKernels!, ...jupyterKernels!, ...interprters];
    }
}

export class JupyterSessionKernelSelectionnListProvider implements IKernelSelectionListProvider {
    constructor(private readonly session: IJupyterSessionManager) {}
    public async getKernelSelections(_cancelToken?: CancellationToken | undefined): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.session.getActiveKernelSpecs();
        return items.filter(item => item.display_name || item.name).map(getQuickPickFromKernelSpec);
    }
}

export class JupyterKernelSelectionnListProvider implements IKernelSelectionListProvider {
    constructor(private readonly kernelService: KernelService) {}
    public async getKernelSelections(cancelToken?: CancellationToken | undefined): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.kernelService.getLocalKernelSpecs(cancelToken);
        return items.filter(item => item.display_name || item.name).map(getQuickPickFromKernelSpec);
    }
}

// tslint:disable: max-classes-per-file
export class InterpreterKernelSelectionnListProvider implements IKernelSelectionListProvider {
    constructor(private readonly interpreterSelector: IInterpreterSelector) {}
    public async getKernelSelections(_cancelToken?: CancellationToken | undefined): Promise<IKernelSpecQuickPickItem[]> {
        const items = await this.interpreterSelector.getSuggestions(undefined);
        return items.map(item => {
            return {
                ...item,
                selection: { interpreter: item.interpreter }
            };
        });
    }
}
