// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as child_process from 'child_process';
import * as os from 'os';
import { window } from 'vscode';
import { commands, Disposable, TextDocument, workspace } from 'vscode';
import { PythonLanguage } from '../common/constants';
import { IPersistentStateFactory, PersistentState } from '../common/persistentState';
import { FEEDBACK } from '../telemetry/constants';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry/index';
import { FeedbackCounters } from './counters';

const FEEDBACK_URL = 'https://www.surveymonkey.com/r/293C9HY';

export class FeedbackService implements Disposable {
    private counters?: FeedbackCounters;
    private showFeedbackPrompt: PersistentState<boolean>;
    private userResponded: PersistentState<boolean>;
    private promptDisplayed: boolean;
    private disposables: Disposable[] = [];
    private get canShowPrompt(): boolean {
        return this.showFeedbackPrompt.value && !this.userResponded.value &&
            !this.promptDisplayed && this.counters !== undefined;
    }
    constructor(persistentStateFactory: IPersistentStateFactory) {
        this.showFeedbackPrompt = persistentStateFactory.createGlobalPersistentState('SHOW_FEEDBACK_PROMPT', true);
        this.userResponded = persistentStateFactory.createGlobalPersistentState('RESPONDED_TO_FEEDBACK', false);
        if (this.showFeedbackPrompt.value && !this.userResponded.value) {
            this.initialize();
        }
    }
    public dispose() {
        this.counters = undefined;
        this.disposables.forEach(disposable => {
            // tslint:disable-next-line:no-unsafe-any
            disposable.dispose();
        });
        this.disposables = [];
    }
    private initialize() {
        // tslint:disable-next-line:no-void-expression
        let commandDisable = commands.registerCommand('python.updateFeedbackCounter', (telemetryEventName: string) => this.updateFeedbackCounter(telemetryEventName));
        this.disposables.push(commandDisable);
        // tslint:disable-next-line:no-void-expression
        commandDisable = workspace.onDidChangeTextDocument(changeEvent => this.handleChangesToTextDocument(changeEvent.document), this, this.disposables);
        this.disposables.push(commandDisable);

        this.counters = new FeedbackCounters();
        this.counters.on('thresholdReached', () => {
            this.thresholdHandler();
        });
    }
    private handleChangesToTextDocument(textDocument: TextDocument) {
        if (textDocument.languageId !== PythonLanguage.language) {
            return;
        }
        if (!this.canShowPrompt) {
            return;
        }
        this.counters.incrementEditCounter();
    }
    private updateFeedbackCounter(telemetryEventName: string): void {
        // Ignore feedback events.
        if (telemetryEventName === FEEDBACK) {
            return;
        }
        if (!this.canShowPrompt) {
            return;
        }
        this.counters.incrementFeatureUsageCounter();
    }
    private thresholdHandler() {
        if (!this.canShowPrompt) {
            return;
        }
        this.showPrompt();
    }
    private showPrompt() {
        this.promptDisplayed = true;

        const message = 'Would you tell us how likely you are to recommend the Microsoft Python extension for VS Code to a friend or colleague?';
        const yesButton = 'Yes';
        const dontShowAgainButton = 'Don\'t Show Again';
        window.showInformationMessage(message, yesButton, dontShowAgainButton).then((value) => {
            switch (value) {
                case yesButton: {
                    this.displaySurvey();
                    break;
                }
                case dontShowAgainButton: {
                    this.doNotShowFeedbackAgain();
                    break;
                }
                default: {
                    sendTelemetryEvent(FEEDBACK, undefined, { action: 'dismissed' });
                    break;
                }
            }
            // Stop everything for this session.
            this.dispose();
        });
    }
    @captureTelemetry(FEEDBACK, { action: 'accepted' })
    private displaySurvey() {
        this.userResponded.value = true;

        let openCommand: string | undefined;
        if (os.platform() === 'win32') {
            openCommand = 'explorer';
        } else if (os.platform() === 'darwin') {
            openCommand = '/usr/bin/open';
        } else {
            openCommand = '/usr/bin/xdg-open';
        }
        if (!openCommand) {
            console.error(`Unable to determine platform to capture user feedback in Python extension ${os.platform()}`);
            console.error(`Survey link is: ${FEEDBACK_URL}`);
        }
        child_process.spawn(openCommand, [FEEDBACK_URL]);
    }
    @captureTelemetry(FEEDBACK, { action: 'doNotShowAgain' })
    private doNotShowFeedbackAgain() {
        this.showFeedbackPrompt.value = false;
    }
}
