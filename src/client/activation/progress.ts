// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Progress, ProgressLocation, window } from 'vscode';
import { Disposable, LanguageClient } from 'vscode-languageclient';
import { createDeferred, Deferred } from '../../utils/async';

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
      if (this.progressDeferred) { // if we restarted, no worries as reporting will still funnel to the same place.
        return;
      }

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
        this.progress = undefined;
      }
    });

    // tslint:disable-next-line:no-suspicious-comment
    // TODO: (from https://github.com/Microsoft/vscode-python/pull/2597#discussion_r217892043)
    // For #2297 (while most of the problem is not here, restart is rare) you need
    // to track 'stateChange' on the language client. When it gets to 'stopped' LS has terminated
  }
}
