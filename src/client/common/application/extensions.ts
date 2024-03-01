/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { Event, Extension, extensions } from 'vscode';
import * as stacktrace from 'stack-trace';

import { IExtensions } from '../types';
import { PVSC_EXTENSION_ID } from '../constants';
import { traceError } from '../../logging';

function parseStack(ex: Error) {
    // Work around bug in stackTrace when ex has an array already
    if (ex.stack && Array.isArray(ex.stack)) {
        const concatenated = { ...ex, stack: ex.stack.join('\n') };
        // Work around for https://github.com/microsoft/vscode-jupyter/issues/12550
        return stacktrace.parse.call(stacktrace, concatenated);
    }
    // Work around for https://github.com/microsoft/vscode-jupyter/issues/12550
    return stacktrace.parse.call(stacktrace, ex);
}

/**
 * Provides functions for tracking the list of extensions that VSCode has installed.
 */
@injectable()
export class Extensions implements IExtensions {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _cachedExtensions?: readonly Extension<any>[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public get all(): readonly Extension<any>[] {
        return extensions.all;
    }

    public get onDidChange(): Event<void> {
        return extensions.onDidChange;
    }

    public getExtension(extensionId: string): Extension<unknown> | undefined {
        return extensions.getExtension(extensionId);
    }

    private get cachedExtensions() {
        if (!this._cachedExtensions) {
            this._cachedExtensions = extensions.all;
            extensions.onDidChange(() => {
                this._cachedExtensions = extensions.all;
            });
        }
        return this._cachedExtensions;
    }

    /**
     * Code borrowed from:
     * https://github.com/microsoft/vscode-jupyter/blob/67fe33d072f11d6443cf232a06bed0ac5e24682c/src/platform/common/application/extensions.node.ts
     */
    public determineExtensionFromCallStack(): { extensionId: string; displayName: string } {
        const { stack } = new Error();
        try {
            if (stack) {
                const jupyterExtRoot = extensions
                    .getExtension(PVSC_EXTENSION_ID)!
                    .extensionUri.toString()
                    .toLowerCase();
                const frames = stack
                    .split('\n')
                    .map((f) => {
                        const result = /\((.*)\)/.exec(f);
                        if (result) {
                            return result[1];
                        }
                        return undefined;
                    })
                    .filter((item) => item && !item.toLowerCase().startsWith(jupyterExtRoot)) as string[];
                parseStack(new Error('Ex')).forEach((item) => {
                    const fileName = item.getFileName();
                    if (fileName && !fileName.toLowerCase().startsWith(jupyterExtRoot)) {
                        frames.push(fileName);
                    }
                });
                for (const frame of frames) {
                    const matchingExt = this.cachedExtensions.find(
                        (ext) =>
                            ext.id !== PVSC_EXTENSION_ID &&
                            (frame.toLowerCase().startsWith(ext.extensionUri.fsPath.toLowerCase()) ||
                                frame.toLowerCase().startsWith(ext.extensionUri.path.toLowerCase())),
                    );
                    if (matchingExt) {
                        return { extensionId: matchingExt.id, displayName: matchingExt.packageJSON.displayName };
                    }
                }
            }
            return { extensionId: 'unknown', displayName: 'unknown' };
        } catch (ex) {
            traceError(`Unable to determine the caller of the extension API for trace stack.`, stack, ex);
            return { extensionId: 'unknown', displayName: 'unknown' };
        }
    }
}
