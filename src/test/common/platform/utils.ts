// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fsextra from 'fs-extra';
import * as net from 'net';
import * as path from 'path';
import * as tmpMod from 'tmp';

// Note: all functional tests that trigger the VS Code "fs" API are
// found in filesystem.test.ts.

export const WINDOWS = /^win/.test(process.platform);

export const DOES_NOT_EXIST = 'this file does not exist';

export async function assertDoesNotExist(filename: string) {
    await expect(
        fsextra.stat(filename)
    ).to.eventually.be.rejected;
}

export async function assertExists(filename: string) {
    await expect(
        fsextra.stat(filename)
    ).to.not.eventually.be.rejected;
}

export class FSFixture {
    public tempDir: tmpMod.SynchrounousResult | undefined;
    public sockServer: net.Server | undefined;

    public async cleanUp() {
        if (this.tempDir) {
            const tempDir = this.tempDir;
            this.tempDir = undefined;
            try {
                tempDir.removeCallback();
            } catch {
                // The "unsafeCleanup: true" option is supposed
                // to support a non-empty directory, but apparently
                // that isn't always the case.  (see #8804)
                await fsextra.remove(tempDir.name);
            }
        }
        if (this.sockServer) {
            const srv = this.sockServer;
            await new Promise(resolve => srv.close(resolve));
            this.sockServer = undefined;
        }
    }

    public async resolve(relname: string, mkdirs = true): Promise<string> {
        if (!this.tempDir) {
            this.tempDir = tmpMod.dirSync({
                prefix: 'pyvsc-fs-tests-',
                unsafeCleanup: true
            });
        }
        relname = path.normalize(relname);
        const filename = path.join(this.tempDir.name, relname);
        if (mkdirs) {
            await fsextra.mkdirp(
                path.dirname(filename));
        }
        return filename;
    }

    public async createFile(relname: string, text = ''): Promise<string> {
        const filename = await this.resolve(relname);
        await fsextra.writeFile(filename, text);
        return filename;
    }

    public async createDirectory(relname: string): Promise<string> {
        const dirname = await this.resolve(relname);
        await fsextra.mkdir(dirname);
        return dirname;
    }

    public async createSymlink(relname: string, source: string): Promise<string> {
        const symlink = await this.resolve(relname);
        await fsextra.ensureSymlink(source, symlink);
        return symlink;
    }

    public async createSocket(relname: string): Promise<string> {
        if (!this.sockServer) {
            this.sockServer = net.createServer();
        }
        const srv = this.sockServer!;
        const filename = await this.resolve(relname);
        await new Promise(resolve => srv!.listen(filename, 0, resolve));
        return filename;
    }
}
