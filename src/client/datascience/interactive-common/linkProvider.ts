// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import { commands, Event, EventEmitter, Position, Range, Selection, TextEditorRevealType, Uri } from 'vscode';

import { IApplicationShell, ICommandManager, IDocumentManager } from '../../common/application/types';

import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IDataScienceFileSystem, IInteractiveWindowListener } from '../types';
import { InteractiveWindowMessages } from './interactiveWindowTypes';

const LineQueryRegex = /line=(\d+)/;

// The following list of commands represent those that can be executed
// in a markdown cell using the syntax: https://command:[my.vscode.command].
const linkCommandWhitelist = [
    'python.datascience.gatherquality',
    'python.datascience.latestExtension',
    'python.datascience.enableLoadingWidgetScriptsFromThirdPartySource'
];

// tslint:disable: no-any
@injectable()
export class LinkProvider implements IInteractiveWindowListener {
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        payload: any;
    }>();
    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IDataScienceFileSystem) private fs: IDataScienceFileSystem,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(ICommandManager) private commandManager: ICommandManager
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
                    const href: string = payload.toString();
                    if (href.startsWith('file')) {
                        this.openFile(href);
                    } else if (href.startsWith('https://command:')) {
                        const temp: string = href.split(':')[2];
                        const params: string[] = temp.includes('/?') ? temp.split('/?')[1].split(',') : [];
                        let command = temp.split('/?')[0];
                        if (command.endsWith('/')) {
                            command = command.substring(0, command.length - 1);
                        }
                        if (linkCommandWhitelist.includes(command)) {
                            commands.executeCommand(command, params);
                        }
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
                        .then((f) => {
                            if (f) {
                                const buffer = new Buffer(payload.replace('data:image/png;base64', ''), 'base64');
                                this.fs.writeFile(f, buffer).ignoreErrors();
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
        let editor = this.documentManager.visibleTextEditors.find((e) => this.fs.arePathsSame(e.document.uri, uri));
        if (editor) {
            this.documentManager
                .showTextDocument(editor.document, { selection, viewColumn: editor.viewColumn })
                .then((e) => {
                    e.revealRange(selection, TextEditorRevealType.InCenter);
                });
        } else {
            // Not a visible editor, try opening otherwise
            this.commandManager.executeCommand('vscode.open', uri).then(() => {
                // See if that opened a text document
                editor = this.documentManager.visibleTextEditors.find((e) => this.fs.arePathsSame(e.document.uri, uri));
                if (editor) {
                    // Force the selection to change
                    editor.revealRange(selection);
                    editor.selection = new Selection(selection.start, selection.start);
                }
            });
        }
    }
}
