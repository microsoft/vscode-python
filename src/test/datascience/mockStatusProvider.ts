import { Disposable } from 'vscode';
import { IInteractiveBase, IStatusProvider } from '../../client/datascience/types';
import { noop } from '../core';
export class MockStatusProvider implements IStatusProvider {
    public set(_message: string, _inweb: boolean, _timeout?: number, _cancel?: () => void, _panel?: IInteractiveBase): Disposable {
        return {
            dispose: noop
        };
    }

    public waitWithStatus<T>(promise: () => Promise<T>, _message: string, _inweb: boolean, _timeout?: number, _canceled?: () => void, _panel?: IInteractiveBase): Promise<T> {
        return promise();
    }
}
