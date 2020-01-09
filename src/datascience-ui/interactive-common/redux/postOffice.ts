// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as Redux from 'redux';

import { IInteractiveWindowMapping, InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages, SharedMessages } from '../../../client/datascience/messages';
import { PostOffice } from '../../react-common/postOffice';

// Action types for Incoming messages. Basically all possible messages prefixed with the word 'action'
// This allows us to have a reducer for an incoming message and a separate reducer for an outgoing message.
// Note: Couldn't figure out a way to just generate this from the keys of the InteractiveWindowMessages.
// String literals can't come from a concat of another
export enum IncomingMessageActions {
    // tslint:disable-next-line: prefer-template
    STARTCELL = 'action.start_cell',
    FINISHCELL = 'action.finish_cell',
    UPDATECELL = 'action.update_cell',
    GOTOCODECELL = 'action.gotocell_code',
    COPYCODECELL = 'action.copycell_code',
    RESTARTKERNEL = 'action.restart_kernel',
    EXPORT = 'action.export_to_ipynb',
    GETALLCELLS = 'action.get_all_cells',
    RETURNALLCELLS = 'action.return_all_cells',
    DELETECELL = 'action.delete_cell',
    DELETEALLCELLS = 'action.delete_all_cells',
    UNDO = 'action.undo',
    REDO = 'action.redo',
    EXPANDALL = 'action.expand_all',
    COLLAPSEALL = 'action.collapse_all',
    STARTPROGRESS = 'action.start_progress',
    STOPPROGRESS = 'action.stop_progress',
    INTERRUPT = 'action.interrupt',
    SUBMITNEWCELL = 'action.submit_new_cell',
    UPDATESETTINGS = 'action.update_settings',
    DOSAVE = 'action.DoSave',
    SENDINFO = 'action.send_info',
    STARTED = 'action.started',
    ADDEDSYSINFO = 'action.added_sys_info',
    REMOTEADDCODE = 'action.remote_add_code',
    REMOTEREEXECUTECODE = 'action.remote_reexecute_code',
    ACTIVATE = 'action.activate',
    SHOWDATAVIEWER = 'action.show_data_explorer',
    GETVARIABLESREQUEST = 'ACTION.GET_VARIABLES_REQUEST',
    GETVARIABLESRESPONSE = 'action.get_variables_response',
    GETVARIABLEVALUEREQUEST = 'action.get_variable_value_request',
    GETVARIABLEVALUERESPONSE = 'action.get_variable_value_response',
    VARIABLEEXPLORERTOGGLE = 'action.variable_explorer_toggle',
    PROVIDECOMPLETIONITEMSREQUEST = 'action.provide_completion_items_request',
    CANCELCOMPLETIONITEMSREQUEST = 'action.cancel_completion_items_request',
    PROVIDECOMPLETIONITEMSRESPONSE = 'action.provide_completion_items_response',
    PROVIDEHOVERREQUEST = 'action.provide_hover_request',
    CANCELHOVERREQUEST = 'action.cancel_hover_request',
    PROVIDEHOVERRESPONSE = 'action.provide_hover_response',
    PROVIDESIGNATUREHELPREQUEST = 'action.provide_signature_help_request',
    CANCELSIGNATUREHELPREQUEST = 'action.cancel_signature_help_request',
    PROVIDESIGNATUREHELPRESPONSE = 'action.provide_signature_help_response',
    ADDCELL = 'action.add_cell',
    EDITCELL = 'action.edit_cell',
    REMOVECELL = 'action.remove_cell',
    SWAPCELLS = 'action.swap_cells',
    INSERTCELL = 'action.insert_cell',
    LOADONIGASMASSEMBLYREQUEST = 'action.load_onigasm_assembly_request',
    LOADONIGASMASSEMBLYRESPONSE = 'action.load_onigasm_assembly_response',
    LOADTMLANGUAGEREQUEST = 'action.load_tmlanguage_request',
    LOADTMLANGUAGERESPONSE = 'action.load_tmlanguage_response',
    OPENLINK = 'action.open_link',
    SHOWPLOT = 'action.show_plot',
    STARTDEBUGGING = 'action.start_debugging',
    STOPDEBUGGING = 'action.stop_debugging',
    GATHERCODE = 'action.gather_code',
    LOADALLCELLS = 'action.load_all_cells',
    LOADALLCELLSCOMPLETE = 'action.load_all_cells_complete',
    SCROLLTOCELL = 'action.scroll_to_cell',
    REEXECUTECELL = 'action.reexecute_cell',
    NOTEBOOKIDENTITY = 'action.identity',
    NOTEBOOKDIRTY = 'action.dirty',
    NOTEBOOKCLEAN = 'action.clean',
    SAVEALL = 'action.save_all',
    NATIVECOMMAND = 'action.native_command',
    VARIABLESCOMPLETE = 'action.variables_complete',
    NOTEBOOKRUNALLCELLS = 'action.notebook_run_all_cells',
    NOTEBOOKRUNSELECTEDCELL = 'action.notebook_run_selected_cell',
    NOTEBOOKADDCELLBELOW = 'action.notebook_add_cell_below',
    RENDERCOMPLETE = 'action.finished_rendering_cells',
    FOCUSEDCELLEDITOR = 'action.focused_cell_editor',
    MONACOREADY = 'action.monaco_ready',
    GETCSSREQUEST = 'action.get_css_request',
    GETCSSRESPONSE = 'action.get_css_response',
    GETMONACOTHEMEREQUEST = 'action.get_monaco_theme_request',
    GETMONACOTHEMERESPONSE = 'action.get_monaco_theme_response',
    UPDATEKERNEL = 'action.update_kernel',
    LOCINIT = 'action.loc_init'
}

export const AllowedMessages = [...Object.values(InteractiveWindowMessages), ...Object.values(CssMessages), ...Object.values(SharedMessages)];

// Actions created from messages
export function createPostableAction<M extends IInteractiveWindowMapping, T extends keyof M = keyof M>(message: T, payload?: M[T]): Redux.AnyAction {
    return { type: `${message}`, payload };
}

export function generatePostOfficeSendReducer(postOffice: PostOffice): Redux.Reducer<{}, Redux.AnyAction> {
    // tslint:disable-next-line: no-function-expression
    return function(_state: {} | undefined, action: Redux.AnyAction): {} {
        // Make sure a valid message
        if (AllowedMessages.find(k => k === action.type)) {
            // Just post this to the post office.
            // tslint:disable-next-line: no-any
            postOffice.sendMessage<IInteractiveWindowMapping>(action.type, action.payload);
        }

        // We don't modify the state.
        return {};
    };
}
