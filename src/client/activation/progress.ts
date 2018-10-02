// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Progress, ProgressLocation, window } from 'vscode';
import { Disposable, LanguageClient } from 'vscode-languageclient';
import { createDeferred, Deferred } from '../../utils/async';
import { StopWatch } from '../../utils/stopWatch';
import { sendTelemetryEvent } from '../telemetry';
import { PYTHON_LANGUAGE_SERVER_ANALYSISTIME } from '../telemetry/constants';

// Draw the line at Language Server analysis 'timing out'
// and becoming a failure-case at 1 minute:
const ANALYSIS_TIMEOUT_MS: number = 60000;

export class ProgressReporting implements Disposable {
  private statusBarMessage: Disposable | undefined;
  private progress: Progress<{ message?: string; increment?: number }> | undefined;
  private progressDeferred: Deferred<void> | undefined;
  private progressTimer?: StopWatch;
  // tslint:disable-next-line:no-unused-variable
  private progressTimeout?: NodeJS.Timer;

  constructor(private readonly languageClient: LanguageClient) {
    this.languageClient.onNotification('python/setStatusBarMessage', (m: string) => {
      if (this.statusBarMessage) {
        this.statusBarMessage.dispose();
      }
      this.statusBarMessage = window.setStatusBarMessage(m);
    });

    this.languageClient.onNotification('python/beginProgress', async _ => {
      if (this.progressDeferred) {
        return;
      }

      this.progressDeferred = createDeferred<void>();
      this.progressTimer = new StopWatch();
      this.progressTimeout = global.setTimeout(
        this.handleTimeout.bind(this),
        ANALYSIS_TIMEOUT_MS
      );

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
        this.completeAnalysisTracking(true);
      }
    });
  }
  public dispose() {
    if (this.statusBarMessage) {
      this.statusBarMessage.dispose();
    }
  }
  private completeAnalysisTracking(success: boolean): void {
    if (this.progressTimer) {
      sendTelemetryEvent(
        PYTHON_LANGUAGE_SERVER_ANALYSISTIME,
        this.progressTimer.elapsedTime,
        { success }
      );
    }
    this.progressTimer = undefined;
    this.progressTimeout = undefined;
  }

  // tslint:disable-next-line:no-any
  private handleTimeout(_args: any[]): void {
    this.completeAnalysisTracking(false);
  }
}
