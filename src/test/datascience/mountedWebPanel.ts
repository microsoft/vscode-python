import { ReactWrapper } from 'enzyme';
import { IWebPanel, IWebPanelMessageListener, IWebPanelOptions } from '../../client/common/application/types';
import { IDisposable } from '../../client/common/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';

// tslint:disable: no-any
export interface IMountedWebView extends IDisposable {
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component> | undefined;
    mount(): void;
    waitForMessageResponse(action: () => void): Promise<void>;
    postMessage(ev: MessageEvent): void;
}

export function createMountedWebPanel(
    ioc: DataScienceIocContainer,
    options: IWebPanelOptions
): IWebPanel & IDisposable {
    return new MountedWebPanel(ioc, options);
}

class MountedWebPanel implements IWebPanel, IDisposable {
    public wrapper: ReactWrapper<any, Readonly<{}>, React.Component> | undefined;
    private webPanelListener: IWebPanelMessageListener | undefined;
    constructor(private ioc: DataScienceIocContainer, options: IWebPanelOptions) {}

    public dispose() {
        if (this.wrapper) {
            this.wrapper.unmount();
            this.wrapper = undefined;
        }
    }
}
