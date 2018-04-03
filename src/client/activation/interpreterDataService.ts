// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionContext, Uri } from 'vscode';
import { createDeferred } from '../common/helpers';
import { IPlatformService } from '../common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../common/process/types';
import { IServiceContainer } from '../ioc/types';

const DataVersion = 1;

export class InterpreterData {
  constructor(
    public readonly dataVersion: number,
    // tslint:disable-next-line:no-shadowed-variable
    public readonly path: string,
    public readonly version: string,
    public readonly prefix: string,
    public readonly hash: string
  ) { }
}

export class InterpreterDataService {
  constructor(
    private readonly context: ExtensionContext,
    private readonly serviceContainer: IServiceContainer) { }

  public async getInterpreterData(resource?: Uri): Promise<InterpreterData | undefined> {
    const executionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
    const execService = await executionFactory.create(resource);

    const interpreterPath = await execService.getExecutablePath();
    if (interpreterPath.length === 0) {
      return;
    }

    let interpreterData = this.context.globalState.get(interpreterPath) as InterpreterData;
    let interpreterChanged = false;
    if (interpreterData) {
      // Check if interpreter executable changed
      if (interpreterData.dataVersion !== DataVersion) {
        interpreterChanged = true;
      } else {
        const currentHash = await this.getInterpreterHash(interpreterPath);
        interpreterChanged = currentHash !== interpreterData.hash;
      }
    }

    if (interpreterChanged || !interpreterData) {
      interpreterData = await this.getInterpreterDataFromPython(execService, interpreterPath);
      this.context.globalState.update(interpreterPath, interpreterData);
    }
    return interpreterData;
  }

  private async getInterpreterDataFromPython(execService: IPythonExecutionService, interpreterPath: string): Promise<InterpreterData> {
    const result = await execService.exec(['-c', 'import sys; print(sys.version_info); print(sys.prefix)'], {});
    // 2.7.14 (v2.7.14:84471935ed, Sep 16 2017, 20:19:30) <<SOMETIMES NEW LINE HERE>>
    // [MSC v.1500 32 bit (Intel)]
    // C:\Python27
    if (!result.stdout) {
      throw Error('Unable to determine Python interpreter version and system prefix.');
    }
    const output = result.stdout.splitLines({ removeEmptyEntries: true, trim: true });
    if (!output || output.length < 2) {
      throw Error('Unable to parse version and and system prefix from the Python interpreter output.');
    }
    const majorMatches = output[0].match(/major=(\d*?),/);
    const minorMatches = output[0].match(/minor=(\d*?),/);
    if (!majorMatches || majorMatches.length < 2 || !minorMatches || minorMatches.length < 2) {
      throw Error('Unable to parse interpreter version.');
    }
    const prefix = output[output.length - 1];
    const hash = await this.getInterpreterHash(interpreterPath);
    return new InterpreterData(DataVersion, interpreterPath, `${majorMatches[1]}.${minorMatches[1]}`, prefix, hash);
  }

  private getInterpreterHash(interpreterPath: string): Promise<string> {
    const platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
    const pythonExecutable = path.join(path.dirname(interpreterPath), platform.isWindows ? 'python.exe' : 'python');
    // Hash mod time and creation time
    const deferred = createDeferred<string>();
    fs.lstat(pythonExecutable, (err, stats) => {
      if (err) {
        deferred.resolve('');
      } else {
        const actual = createHash('sha512').update(`${stats.ctimeMs}-${stats.mtimeMs}`).digest('hex');
        deferred.resolve(actual);
      }
    });
    return deferred.promise;
  }
}
