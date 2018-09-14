// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Progress, ProgressLocation, window } from 'vscode';
import { Disposable, LanguageClient } from 'vscode-languageclient';
import { createDeferred, Deferred } from '../../utils/async';
import { StopWatch } from '../../utils/stopWatch';
import { sendTelemetryEvent } from '../telemetry';
import { PYTHON_LANGUAGE_SERVER_ANALYSISTIME } from '../telemetry/constants';
import { LanguageServerAnalysisTelemetry } from '../telemetry/types';

export class ProgressReporting {
  private statusBarMessage: Disposable | undefined;
  private progress: Progress<{ message?: string; increment?: number }> | undefined;
  private progressDeferred: Deferred<void> | undefined;
  private progressTimer: StopWatch | undefined;
  private progressTimeout: NodeJS.Timer | undefined;
  private ANALYSIS_TIMEOUT_MS: number = 60000;

  constructor(private readonly languageClient: LanguageClient) {
    this.languageClient.onNotification('python/setStatusBarMessage', (m: string) => {
      if (this.statusBarMessage) {
        this.statusBarMessage.dispose();
      }
      this.statusBarMessage = window.setStatusBarMessage(m);
    });

    this.languageClient.onNotification('python/beginProgress', async _ => {
      this.progressDeferred = createDeferred<void>();
      this.progressTimer = new StopWatch();
      this.progressTimeout = setTimeout(
        // tslint:disable-next-line:no-any
        (...args: any[]) => {
          if (this.progressTimer) {
            const lsAnalysisTelemetry: LanguageServerAnalysisTelemetry = {
              success: false,
              error: `Timeout for analysis to complete (${this.ANALYSIS_TIMEOUT_MS / 1000} sec) reached.`
            };
            sendTelemetryEvent(
              PYTHON_LANGUAGE_SERVER_ANALYSISTIME,
              this.progressTimer.elapsedTime,
              lsAnalysisTelemetry
            );
            this.progressTimer = undefined;
          }
        }, this.ANALYSIS_TIMEOUT_MS
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
      }
      if (this.progressTimeout) {
        this.progressTimeout = undefined;
      }
      if (this.progressTimer) {
        sendTelemetryEvent(
          PYTHON_LANGUAGE_SERVER_ANALYSISTIME,
          this.progressTimer.elapsedTime
        );
        this.progressTimer = undefined;
      }
    });
  }
}
