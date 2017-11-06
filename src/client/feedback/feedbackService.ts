// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as child_process from 'child_process';
import * as os from 'os';
import { window } from 'vscode';
import { commands, Disposable, TextDocument, workspace } from 'vscode';
import { PythonLanguage } from '../common/constants';
import { IPersistentStateFactor, PersistentState } from '../common/persistentState';
import { FEEDBACK } from '../telemetry/constants';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry/index';
import { FeedbackCounters } from './counters';

const FEEDBACK_URL = 'https://aka.ms/egv4z1';

export class FeedbackService implements Disposable {
    private counters?: FeedbackCounters;
    private showFeedbackPrompt: PersistentState<boolean>;
    private userResponded: PersistentState<boolean>;
    private promptDisplayed: boolean;
    private disposables: Disposable[] = [];
    constructor(persistentStateFactory: IPersistentStateFactor) {
        this.showFeedbackPrompt = persistentStateFactory.createGlobalPersistentState('SHOW_FEEDBACK_PROMPT', true);
        this.userResponded = persistentStateFactory.createGlobalPersistentState('RESPONDED_TO_FEEDBACKX', false);
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
        if (!this.showFeedbackPrompt.value || this.userResponded.value || !this.counters) {
            return;
        }
        this.counters.updateEditCounter();
    }
    private updateFeedbackCounter(telemetryEventName: string): void {
        // Ignore feedback events.
        if (telemetryEventName === FEEDBACK) {
            return;
        }
        if (!this.showFeedbackPrompt.value || this.userResponded.value || !this.counters) {
            return;
        }
        this.counters.updateFeatureUsageCounter();
    }
    private thresholdHandler() {
        if (!this.showFeedbackPrompt.value || this.userResponded.value || this.promptDisplayed) {
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
            console.error(`Unable to determine platform to capture user feedback in Microsoft Python extension ${os.platform()}`);
        }
        child_process.spawn(openCommand, [FEEDBACK_URL]);
    }
    @captureTelemetry(FEEDBACK, { action: 'doNotShowAgain' })
    private doNotShowFeedbackAgain() {
        this.showFeedbackPrompt.value = false;
    }
}
