import type { LoadableComponent } from '@loadable/component';

declare module 'pyvscTransforms' {
    export function getRichestMimetype(data: any): string;
    export function getTransform(mimeType: string): LoadableComponent<{ data: any }>;
    export function forceLoad(): Promise<void>;

    export function isMimeTypeSupported(mimeType: string): boolean;
}
