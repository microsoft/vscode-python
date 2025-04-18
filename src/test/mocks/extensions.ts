import { injectable } from 'inversify';
import { IExtensions } from '../../client/common/types';
import { Extension, Event } from 'vscode';

@injectable()
export class MockExtensions implements IExtensions {
    all: readonly Extension<unknown>[] = [];
    onDidChange: Event<void> = (() => {
        throw new Error('Method not implemented');
    })();
    getExtension(extensionId: string): Extension<unknown> | undefined;
    getExtension<T>(extensionId: string): Extension<T> | undefined;
    getExtension(_extensionId: unknown): import('vscode').Extension<unknown> | undefined {
        throw new Error('Method not implemented.');
    }
    determineExtensionFromCallStack(): Promise<{ extensionId: string; displayName: string }> {
        throw new Error('Method not implemented.');
    }
}
