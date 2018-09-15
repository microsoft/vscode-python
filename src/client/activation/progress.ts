// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Progress, ProgressLocation, window } from 'vscode';
import { Disposable, LanguageClient } from 'vscode-languageclient';
import { createDeferred, Deferred } from '../../utils/async';
import { StopWatch } from '../../utils/stopWatch';
import { sendTelemetryEvent } from '../telemetry';
import { PYTHON_LANGUAGE_SERVER_ANALYSISTIME } from '../telemetry/constants';
import { LanguageServerTelemetry } from '../telemetry/types';

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
      if (this.progressDeferred) { // if we restarted, no worries as reporting will still funnel to the same place.
        return;
      }

      this.progressDeferred = createDeferred<void>();
      this.progressTimer = new StopWatch();
      this.progressTimeout = setTimeout(this.handleTimeout, this.ANALYSIS_TIMEOUT_MS);

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
        this.completeAnalysisTracking(true);
        this.progress = undefined;
      }
    });
  }

  private completeAnalysisTracking(isSuccess: boolean): void {
    if (this.progressTimer) {
      const lsAnalysisTelemetry: LanguageServerTelemetry = {
        success: isSuccess
      };
      sendTelemetryEvent(
        PYTHON_LANGUAGE_SERVER_ANALYSISTIME,
        this.progressTimer.elapsedTime,
        lsAnalysisTelemetry
      );
      this.progressTimer = undefined;
    }

    if (this.progressTimeout) {
      this.progressTimeout = undefined;
    }
  }

  // tslint:disable-next-line:no-any
  private handleTimeout(_args: any[]): void {
    this.completeAnalysisTracking(false);
  }
}
