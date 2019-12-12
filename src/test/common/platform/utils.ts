// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-console

import { expect } from 'chai';
import * as fsextra from 'fs-extra';
import * as net from 'net';
import * as path from 'path';
import * as tmpMod from 'tmp';

// Note: all functional tests that trigger the VS Code "fs" API are
// found in filesystem.test.ts.

export const WINDOWS = /^win/.test(process.platform);

export const SUPPORTS_SYMLINKS = (() => {
    const source = fsextra.readdirSync('.')[0];
    const symlink = `${source}.symlink`;
    try {
        fsextra.symlinkSync(source, symlink);
    } catch {
        return false;
    }
    fsextra.unlinkSync(symlink);
    return true;
})();

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

export function fixPath(filename: string): string {
    return path.normalize(filename);
}

export class CleanupFixture {
    private cleanups: (() => void | Promise<void>)[];
    constructor() {
        this.cleanups = [];
    }

    public addCleanup(cleanup: () => void | Promise<void>) {
        this.cleanups.push(cleanup);
    }

    public async cleanUp() {
        const cleanups = this.cleanups;
        this.cleanups = [];

        return Promise.all(cleanups.map(async (cleanup, i) => {
            try {
                const res = cleanup();
                if (res) {
                    await res;
                }
            } catch (err) {
                console.log(`cleanup ${i + 1} failed: ${err}`);
                console.log('moving on...');
            }
        }));
    }
}

export class FSFixture extends CleanupFixture {
    private tempDir: string | undefined;
    private sockServer: net.Server | undefined;

    public addFSCleanup(filename: string, dispose?: () => void) {
        this.addCleanup(() => this.ensureDeleted(filename, dispose));
    }

    public async resolve(relname: string, mkdirs = true): Promise<string> {
        const tempDir = this.ensureTempDir();
        relname = path.normalize(relname);
        const filename = path.join(tempDir, relname);
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
        if (!SUPPORTS_SYMLINKS) {
            throw Error('this platform does not support symlinks');
        }
        const symlink = await this.resolve(relname);
        // We cannot use fsextra.ensureSymlink() because it requires
        // that "source" exist.
        await fsextra.symlink(source, symlink);
        return symlink;
    }

    public async createSocket(relname: string): Promise<string> {
        const srv = this.ensureSocketServer();
        const filename = await this.resolve(relname);
        await new Promise(resolve => srv!.listen(filename, 0, resolve));
        return filename;
    }

    public async ensureDeleted(filename: string, dispose?: () => void) {
        if (dispose) {
            try {
                dispose();
                return; // Trust that dispose() did what it's supposed to.
            } catch (err) {
                // For temp directories, the "unsafeCleanup: true"
                // option of the "tmp" module is supposed to support
                // a non-empty directory, but apparently that isn't
                // always the case.
                // (see #8804)
                if (!await fsextra.pathExists(filename)) {
                    return;
                }
                console.log(`failure during dispose() for ${filename}: ${err}`);
                console.log('...manually deleting');
                // Fall back to fsextra.
            }
        }

        try {
            await fsextra.remove(filename);
        } catch (err) {
            if (!await fsextra.pathExists(filename)) {
                return;
            }
            console.log(`failure while deleting ${filename}: ${err}`);
        }
    }

    private ensureTempDir(): string {
        if (this.tempDir) {
            return this.tempDir;
        }

        const tempDir = tmpMod.dirSync({
            prefix: 'pyvsc-fs-tests-',
            unsafeCleanup: true
        });
        this.tempDir = tempDir.name;

        this.addFSCleanup(tempDir.name, async () => {
            if (!this.tempDir) {
                return;
            }
            this.tempDir = undefined;

            await this.ensureDeleted(tempDir.name, tempDir.removeCallback);
            //try {
            //    tempDir.removeCallback();
            //} catch {
            //    // The "unsafeCleanup: true" option is supposed
            //    // to support a non-empty directory, but apparently
            //    // that isn't always the case.  (see #8804)
            //    await fsextra.remove(tempDir.name);
            //}
        });
        return tempDir.name;
    }

    private ensureSocketServer(): net.Server {
        if (this.sockServer) {
            return this.sockServer;
        }

        const srv = net.createServer();
        this.sockServer = srv;
        this.addCleanup(async () => {
            try {
                await new Promise(resolve => srv.close(resolve));
            } catch (err) {
                console.log(`failure while closing socket server: ${err}`);
            }
        });
        return srv;
    }
}
