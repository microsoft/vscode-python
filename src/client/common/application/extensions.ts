/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, Extension, extensions } from 'vscode';
import * as stacktrace from 'stack-trace';
import * as path from 'path';
import { IExtensions } from '../types';
import { IFileSystem } from '../platform/types';
import { EXTENSION_ROOT_DIR } from '../constants';
import { traceVerbose } from '../../logging';

/**
 * Provides functions for tracking the list of extensions that VSCode has installed.
 */
@injectable()
export class Extensions implements IExtensions {
    constructor(@inject(IFileSystem) private readonly fs: IFileSystem) {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public get all(): readonly Extension<any>[] {
        return extensions.all;
    }

    public get onDidChange(): Event<void> {
        return extensions.onDidChange;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _cachedExtensions?: readonly Extension<any>[];

    private get cachedExtensions() {
        if (!this._cachedExtensions) {
            this._cachedExtensions = extensions.all;
            extensions.onDidChange(() => {
                this._cachedExtensions = extensions.all;
            });
        }
        return this._cachedExtensions;
    }

    public getExtension(extensionId: string): Extension<unknown> | undefined {
        return extensions.getExtension(extensionId);
    }

    /**
     * Code borrowed from:
     * https://github.com/microsoft/vscode-jupyter/blob/67fe33d072f11d6443cf232a06bed0ac5e24682c/src/platform/common/application/extensions.node.ts
     */
    public async determineExtensionFromCallStack(): Promise<{ extensionId: string; displayName: string }> {
        const { stack } = new Error();
        if (stack) {
            const a = this.all;
            const b = this.cachedExtensions;
            // traceVerbose('Print all extensions', JSON.stringify(this.all));
            const pythonExtRoot = path.join(EXTENSION_ROOT_DIR.toLowerCase(), path.sep);
            const frames = stack
                .split('\n')
                .map((f) => {
                    const result = /\((.*)\)/.exec(f);
                    if (result) {
                        return result[1];
                    }
                    return undefined;
                })
                .filter((item) => item && !item.toLowerCase().startsWith(pythonExtRoot))
                .filter((item) =>
                    this.cachedExtensions.some(
                        (ext) => item!.includes(ext.extensionUri.path) || item!.includes(ext.extensionUri.fsPath),
                    ),
                ) as string[];
            stacktrace.parse(new Error('Ex')).forEach((item) => {
                const fileName = item.getFileName();
                if (fileName && !fileName.toLowerCase().startsWith(pythonExtRoot)) {
                    frames.push(fileName);
                }
            });
            for (const frame of frames) {
                // This file is from a different extension. Try to find its `package.json`.
                let dirName = path.dirname(frame);
                let last = frame;
                while (dirName && dirName.length < last.length) {
                    const possiblePackageJson = path.join(dirName, 'package.json');
                    if (await this.fs.pathExists(possiblePackageJson)) {
                        const text = await this.fs.readFile(possiblePackageJson);
                        try {
                            const json = JSON.parse(text);
                            return { extensionId: `${json.publisher}.${json.name}`, displayName: json.displayName };
                        } catch {
                            // If parse fails, then not an extension.
                        }
                    }
                    last = dirName;
                    dirName = path.dirname(dirName);
                }
            }
        }
        return { extensionId: 'unknown', displayName: 'unknown' };
    }
}
