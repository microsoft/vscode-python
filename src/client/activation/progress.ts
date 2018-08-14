// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Progress, ProgressLocation, window } from 'vscode';
import { Disposable, LanguageClient } from 'vscode-languageclient';
import { createDeferred, Deferred } from '../common/helpers';

export class ProgressReporting {
  private statusBarMessage: Disposable | undefined;
  private progress: Progress<{ message?: string; increment?: number }> | undefined;
  private progressDeferred: Deferred<void> | undefined;

  constructor(private readonly languageClient: LanguageClient) {
    this.languageClient.onNotification('python/setStatusBarMessage', (m: string) => {
      if (this.statusBarMessage) {
        this.statusBarMessage.dispose();
      }
      this.statusBarMessage = window.setStatusBarMessage(m);
    });

    this.languageClient.onNotification('python/beginProgress', async _ => {
      this.progressDeferred = createDeferred<void>();
      window.withProgress({
        location: ProgressLocation.Window,
        title: ''
      }, progress => {
        this.progress = progress;
        return this.progressDeferred!.promise;
      });
    });

    this.languageClient.onNotification('python/reportProgress', (m: string) => {
      if (!this.progress) {
        return;
      }
      this.progress.report({ message: m });
    });

    this.languageClient.onNotification('python/endProgress', _ => {
      if (this.progressDeferred) {
        this.progressDeferred.resolve();
        this.progressDeferred = undefined;
      }
    });
  }
}
