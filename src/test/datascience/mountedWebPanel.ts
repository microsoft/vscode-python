import { ReactWrapper } from 'enzyme';
import { noop } from 'lodash';
import { Uri } from 'vscode';
import {
    IWebPanel,
    IWebPanelMessageListener,
    IWebPanelOptions,
    WebPanelMessage
} from '../../client/common/application/types';
import { IDisposable } from '../../client/common/types';
import { Deferred } from '../../client/common/utils/async';
import { IVsCodeApi } from '../../datascience-ui/react-common/postOffice';

// tslint:disable: no-any
export interface IMountedWebView extends IWebPanel, IDisposable {
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>;
    postMessage(ev: WebPanelMessage): void;
    changeViewState(active: boolean, visible: boolean): void;
    addMessageListener(callback: (m: string, p: any) => void): void;
    removeMessageListener(callback: (m: string, p: any) => void): void;
    attach(options: IWebPanelOptions): void;
}

const map = new Map<string, MountedWebPanel>();

class MountedWebPanel implements IMountedWebView, IDisposable {
    public wrapper: ReactWrapper<any, Readonly<{}>, React.Component>;
    private missedMessages: any[] = [];
    private webPanelListener: IWebPanelMessageListener | undefined;
    private reactMessageCallback: ((ev: MessageEvent) => void) | undefined;
    private extraListeners: ((m: string, p: any) => void)[] = [];
    private disposed = false;
    private active = true;
    private visible = true;

    constructor(mount: () => ReactWrapper<any, Readonly<{}>, React.Component>, public readonly id: string) {
        // Setup the acquireVsCodeApi. The react control will cache this value when it's mounted.
        const globalAcquireVsCodeApi = (): IVsCodeApi => {
            return {
                // tslint:disable-next-line:no-any
                postMessage: (msg: any) => {
                    this.postMessageToWebPanel(msg);
                },
                // tslint:disable-next-line:no-any no-empty
                setState: (_msg: any) => {},
                // tslint:disable-next-line:no-any no-empty
                getState: () => {
                    return {};
                }
            };
        };
        // tslint:disable-next-line:no-string-literal
        (global as any)['acquireVsCodeApi'] = globalAcquireVsCodeApi;

        // Remap event handlers to point to the container.
        const oldListener = window.addEventListener;
        window.addEventListener = (event: string, cb: any) => {
            if (event === 'message') {
                this.reactMessageCallback = cb;
            }
        };

        // Mount our main panel. This will make the global api be cached and have the event handler registered
        this.wrapper = mount();

        // We can remove the global api and event listener now.
        delete (global as any).acquireVsCodeApi;
        window.addEventListener = oldListener;
    }

    public attach(options: IWebPanelOptions) {
        this.webPanelListener = options.listener;

        // Send messages that were already posted but were missed.
        // During normal operation, the react control will not be created before
        // the webPanelListener
        if (this.missedMessages.length && this.webPanelListener) {
            // This needs to be async because we are being called in the ctor of the webpanel. It can't
            // handle some messages during the ctor.
            setTimeout(() => {
                this.missedMessages.forEach((m) =>
                    this.webPanelListener ? this.webPanelListener.onMessage(m.type, m.payload) : noop()
                );
            }, 0);

            this.missedMessages = [];
        }
    }

    public asWebviewUri(localResource: Uri): Uri {
        return localResource;
    }
    public setTitle(_val: string): void {
        noop();
    }
    public async show(_preserveFocus: boolean): Promise<void> {
        noop();
    }
    public isVisible(): boolean {
        return this.visible;
    }
    public postMessage(m: WebPanelMessage): void {
        // Actually send to the UI
        if (this.reactMessageCallback) {
            // tslint:disable-next-line: no-require-imports
            const reactHelpers = require('./reactHelpers') as typeof import('./reactHelpers');
            const message = reactHelpers.createMessageEvent(m);
            this.reactMessageCallback(message);
            if (m.payload) {
                delete m.payload;
            }
        }
    }
    public close(): void {
        noop();
    }
    public isActive(): boolean {
        return this.active;
    }
    public updateCwd(_cwd: string): void {
        noop();
    }
    public dispose() {
        if (this.wrapper && !this.disposed) {
            this.disposed = true;
            this.wrapper.unmount();
            map.delete(this.id);
        }
    }

    public changeViewState(active: boolean, visible: boolean) {
        this.active = active;
        this.visible = visible;
        if (this.webPanelListener) {
            this.webPanelListener.onChangeViewState(this);
        }
    }
    public addMessageListener(callback: (m: string, p: any) => void) {
        this.extraListeners.push(callback);
    }

    public removeMessageListener(callback: (m: string, p: any) => void) {
        const index = this.extraListeners.indexOf(callback);
        if (index >= 0) {
            this.extraListeners.splice(index, 1);
        }
    }
    private postMessageToWebPanel(msg: any) {
        if (this.webPanelListener) {
            this.webPanelListener.onMessage(msg.type, msg.payload);
        } else {
            this.missedMessages.push({ type: msg.type, payload: msg.payload });
        }
        if (this.extraListeners.length) {
            this.extraListeners.forEach((e) => e(msg.type, msg.payload));
        }

        // Clear out msg payload
        delete msg.payload;
    }
}

export function createMountedWebPanel(
    mount: () => ReactWrapper<any, Readonly<{}>, React.Component>,
    id: string
): IMountedWebView {
    if (map.has(id)) {
        throw new Error(`Mounting the same object more than once: ${id}`);
    }
    const obj = new MountedWebPanel(mount, id);
    map.set(id, obj);
    return obj;
}

export function getMountedWebPanel(id: string): IMountedWebView {
    const obj = map.get(id);
    if (!obj) {
        throw new Error(`Mounted web panel does not exist for ${id}`);
    }
    return obj;
}

export function disposeMountedPanels() {
    map.forEach((v) => v.dispose());
    map.clear();
}
