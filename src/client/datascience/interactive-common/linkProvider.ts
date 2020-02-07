// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Position, Range, TextEditorRevealType, Uri } from 'vscode';

import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IInteractiveWindowListener } from '../types';
import { InteractiveWindowMessages } from './interactiveWindowTypes';

const LineQueryRegex = /line=(\d+)/;

// tslint:disable: no-any
@injectable()
export class LinkProvider implements IInteractiveWindowListener {
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{ message: string; payload: any }>();
    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDocumentManager) private documentManager: IDocumentManager
    ) {
        noop();
    }

    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    public onMessage(message: string, payload?: any): void {
        switch (message) {
            case InteractiveWindowMessages.OpenLink:
                if (payload) {
                    // Special case file URIs
                    const href = payload.toString();
                    if (href.startsWith('file')) {
                        this.openFile(href);
                    } else {
                        this.applicationShell.openUrl(href);
                    }
                }
                break;
            case InteractiveWindowMessages.SavePng:
                if (payload) {
                    // Payload should contain the base 64 encoded string. Ask the user to save the file
                    const filtersObject: Record<string, string[]> = {};
                    filtersObject[localize.DataScience.pngFilter()] = ['png'];

                    // Ask the user what file to save to
                    this.applicationShell
                        .showSaveDialog({
                            saveLabel: localize.DataScience.savePngTitle(),
                            filters: filtersObject
                        })
                        .then(f => {
                            if (f) {
                                const buffer = new Buffer(payload.replace('data:image/png;base64', ''), 'base64');
                                this.fileSystem.writeFile(f.fsPath, buffer).ignoreErrors();
                            }
                        });
                }
                break;
            default:
                break;
        }
    }
    public dispose(): void | undefined {
        noop();
    }

    private openFile(fileUri: string) {
        const uri = Uri.parse(fileUri);
        let selection: Range = new Range(new Position(0, 0), new Position(0, 0));
        if (uri.query) {
            // Might have a line number query on the file name
            const lineMatch = LineQueryRegex.exec(uri.query);
            if (lineMatch) {
                const lineNumber = parseInt(lineMatch[1], 10);
                selection = new Range(new Position(lineNumber, 0), new Position(lineNumber, 0));
            }
        }

        // Show the matching editor if there is one
        const editor = this.documentManager.visibleTextEditors.find(e => this.fileSystem.arePathsSame(e.document.fileName, uri.fsPath));
        if (editor) {
            this.documentManager.showTextDocument(editor.document, { selection, viewColumn: editor.viewColumn }).then(() => {
                editor.revealRange(selection, TextEditorRevealType.InCenter);
            });
        } else {
            this.documentManager.showTextDocument(uri, { selection });
        }
    }
}
