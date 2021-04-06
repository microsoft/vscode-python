// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { ReactWrapper } from 'enzyme';
import { inject, injectable } from 'inversify';
import { IDisposable, IDisposableRegistry } from '../../client/common/types';
import { IMountedWebView, MountedWebView } from './mountedWebView';

export const IMountedWebViewFactory = Symbol('IMountedWebViewFactory');

export interface IMountedWebViewFactory {
    get(id: string): IMountedWebView;

    create(id: string, mount: () => ReactWrapper<any, Readonly<{}>, React.Component>): IMountedWebView;
}

@injectable()
export class MountedWebViewFactory implements IMountedWebViewFactory, IDisposable {
    private map = new Map<string, MountedWebView>();

    constructor(@inject(IDisposableRegistry) readonly disposables: IDisposableRegistry) {
        disposables.push(this);
    }

    public dispose() {
        this.map.forEach((v) => v.dispose());
        this.map.clear();
    }
    public get(id: string): IMountedWebView {
        const obj = this.map.get(id);
        if (!obj) {
            throw new Error(`No mounted web view found for id ${id}`);
        }
        return obj;
    }

    public create(id: string, mount: () => ReactWrapper<any, Readonly<{}>, React.Component>): IMountedWebView {
        if (this.map.has(id)) {
            throw new Error(`Mounted web view already exists for id ${id}`);
        }
        const obj = new MountedWebView(mount, id);
        obj.onDisposed(() => this.map.delete(id));
        this.map.set(id, obj);
        return obj;
    }
}
