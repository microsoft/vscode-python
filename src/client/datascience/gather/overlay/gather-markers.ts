/**
 * Helpers for marking up CodeMirror editors.
 */
import { NotebookPanel } from '@jupyterlab/notebook';
import { LineHandle } from 'codemirror';
import { IGatherCell, LabCell } from '../model/cell';
import { ILocation, ISyntaxNode } from '../analysis/parse/python/python-parser';
import { Ref, SymbolType } from '../analysis/slice/data-flow';
import { SlicedExecution } from '../analysis/slice/log-slicer';
import { log } from '../util/log';
import {
  CellOutput,
  DefSelection,
  EditorDef,
  GatherEventData,
  GatherModel,
  GatherModelEvent,
  IGatherObserver,
  OutputSelection,
} from '../model';
import { NotebookElementFinder } from './element-finder';
import { ICodeCellModel } from '@jupyterlab/cells';
import { Widget, PanelLayout } from '@phosphor/widgets';

/**
 * Class for a highlighted, clickable output.
 */
const OUTPUT_HIGHLIGHTED_CLASS = 'jp-OutputArea-highlighted';

/**
 * Class for a selected output.
 */
const OUTPUT_SELECTED_CLASS = 'jp-OutputArea-selected';

/**
 * Class for a button that lets you gather an output.
 */
const OUTPUT_GATHER_BUTTON_CLASS = 'jp-OutputArea-gatherbutton';

/**
 * Class for a label on a gather button on an output.
 */
const OUTPUT_GATHER_LABEL_CLASS = 'jp-OutputArea-gatherlabel';

/**
 * Class for variable definition text.
 */
const DEFINITION_CLASS = 'jp-InputArea-editor-nametext';

/**
 * Class for selected variable definition text.
 */
const DEFINITION_SELECTED_CLASS = 'jp-InputArea-editor-nametext-selected';

/**
 * Class for a line holding a variable definition.
 */
const DEFINITION_LINE_SELECTED_CLASS = 'jp-InputArea-editor-nameline-selected';

/**
 * Class for a line with a data dependency.
 */
const DEPENDENCY_CLASS = 'jp-InputArea-editor-dependencyline';

/**
 * Class for a line with a data dependency in a dirty cell.
 */
const DIRTY_DEPENDENCY_CLASS = 'jp-InputArea-editor-dirtydependencyline';

/**
 * Clear existing selections in the window.
 */
function clearSelectionsInWindow() {
  if (window && window.getSelection) {
    window.getSelection().removeAllRanges();
  } else if (document.hasOwnProperty('selection')) {
    (document as any).selection.empty();
  }
}

/**
 * Adds and manages text markers.
 */
export class MarkerManager implements IGatherObserver {
  private _model: GatherModel;
  private _elementFinder: NotebookElementFinder;
  private _defMarkers: DefMarker[] = [];
  private _defLineHandles: DefLineHandle[] = [];
  private _outputMarkers: OutputMarker[] = [];
  private _dependencyLineMarkers: DependencyLineMarker[] = [];

  /**
   * Construct a new marker manager.
   */
  constructor(model: GatherModel, notebook: NotebookPanel) {
    this._model = model;
    this._model.addObserver(this);
    this._elementFinder = new NotebookElementFinder(notebook);

    /*
     * XXX(andrewhead): Sometimes in Chrome or Edge, "click" events get dropped when the click
     * occurs on the cell. Mouseup doesn't, so we use that here.
     */
    notebook.content.node.addEventListener('mouseup', (event: MouseEvent) => {
      this.handleClick(event);
    });
  }

  /**
   * Click-handler---pass on click event to markers.
   */
  handleClick(event: MouseEvent) {
    this._defMarkers.forEach(marker => {
      marker.handleClick(event);
    });
  }

  /**
   * Listen for changes to the gather model.
   */
  onModelChange(
    eventType: GatherModelEvent,
    eventData: GatherEventData,
    model: GatherModel
  ) {
    // When a cell is executed, search for definitions and output.
    if (eventType == GatherModelEvent.CELL_EXECUTION_LOGGED) {
      let cell = eventData as IGatherCell;
      this.clearSelectablesForCell(cell);
      let editor = this._elementFinder.getEditor(cell);
      if (editor) {
        this.highlightDefs(editor, cell);
      }
      let outputElements = this._elementFinder.getOutputs(cell);
      this.highlightOutputs(cell, outputElements);
    }

    // When a cell is deleted or edited, delete all of its def markers.
    if (
      eventType == GatherModelEvent.CELL_DELETED ||
      eventType == GatherModelEvent.CELL_EDITED
    ) {
      let cell = eventData as IGatherCell;
      this._updateDependenceHighlightsForCell(cell);
      this.clearSelectablesForCell(cell);
    }

    // When definitions are found, highlight them.
    if (eventType == GatherModelEvent.EDITOR_DEF_FOUND) {
      let editorDef = eventData as EditorDef;
      this.highlightDef(editorDef);
    }

    // When definitions are removed from the model, deselect and remove their markers.
    if (eventType == GatherModelEvent.EDITOR_DEF_REMOVED) {
      let editorDef = eventData as EditorDef;
      for (let i = this._defMarkers.length - 1; i >= 0; i--) {
        let defMarker = this._defMarkers[i];
        if (defMarker.def == editorDef.def) {
          let defsToDeselect = this._model.selectedDefs.filter(
            d => d.editorDef == editorDef
          );
          for (let defToDeselect of defsToDeselect) {
            this._model.deselectDef(defToDeselect);
          }
          defMarker.marker.clear();
          this._defMarkers.splice(i, 1);
        }
      }
    }

    // When outputs are found, highlight them.
    if (eventType == GatherModelEvent.OUTPUT_FOUND) {
      let output = eventData as CellOutput;
      this.highlightOutput(output);
    }

    // When outputs are removed from the model, deselect and remove their markers.
    if (eventType == GatherModelEvent.OUTPUT_REMOVED) {
      let output = eventData as CellOutput;
      for (let i = this._outputMarkers.length - 1; i >= 0; i--) {
        let outputMarker = this._outputMarkers[i];
        if (
          outputMarker.cell == output.cell &&
          outputMarker.outputIndex == output.outputIndex
        ) {
          this._model.deselectOutput({
            cell: output.cell,
            outputIndex: output.outputIndex,
          });
          outputMarker.destroy();
          this._outputMarkers.splice(i, 1);
        }
      }
    }

    // Whenever a definition is selected, add a marker to its line.
    if (eventType == GatherModelEvent.DEF_SELECTED) {
      let defSelection = eventData as DefSelection;
      let editor = defSelection.editorDef.editor;
      let def = defSelection.editorDef.def;
      let lineHandle = editor.addLineClass(
        def.location.first_line - 1,
        'background',
        DEFINITION_LINE_SELECTED_CLASS
      );
      this._defLineHandles.push({ def: def, lineHandle: lineHandle });
    }

    // Whenever a definition is deselected from outside, unhighlight it.
    if (eventType == GatherModelEvent.DEF_DESELECTED) {
      let defSelection = eventData as DefSelection;
      this._defMarkers
        .filter(marker => {
          return (
            defSelection.editorDef.def.location == marker.location &&
            defSelection.cell.executionEventId == marker.cell.executionEventId
          );
        })
        .forEach(marker => marker.deselect());

      let editorDef = defSelection.editorDef;
      for (let i = this._defLineHandles.length - 1; i >= 0; i--) {
        let defLineHandle = this._defLineHandles[i];
        if (defLineHandle.def == editorDef.def) {
          editorDef.editor.removeLineClass(
            defLineHandle.lineHandle,
            'background',
            DEFINITION_LINE_SELECTED_CLASS
          );
        }
      }
    }

    // Whenever an output is deselected from outside, unhighlight it.
    if (eventType == GatherModelEvent.OUTPUT_DESELECTED) {
      let outputSelection = eventData as OutputSelection;
      this._outputMarkers
        .filter(marker => {
          return (
            marker.outputIndex == outputSelection.outputIndex &&
            marker.cell.executionEventId ==
              outputSelection.cell.executionEventId
          );
        })
        .forEach(marker => marker.deselect());
    }

    // When the chosen slices change, update which lines are highlighted in the document.
    if (
      eventType == GatherModelEvent.SLICE_SELECTED ||
      eventType == GatherModelEvent.SLICE_DESELECTED
    ) {
      this._clearDependencyLineMarkers();
      model.selectedSlices.forEach(sliceSelection => {
        this.highlightDependencies(sliceSelection.slice);
      });
    }
  }

  highlightDef(editorDef: EditorDef) {
    let editor = editorDef.editor;
    let def = editorDef.def;
    let doc = editor.getDoc();

    // Add marker for the definition symbol.
    let marker = doc.markText(
      { line: def.location.first_line - 1, ch: def.location.first_column },
      { line: def.location.last_line - 1, ch: def.location.last_column },
      { className: DEFINITION_CLASS }
    );
    let defSelection = new DefSelection({
      editorDef: editorDef,
      cell: editorDef.cell,
    });
    let clickHandler = (
      _: IGatherCell,
      __: ILocation,
      selected: boolean,
      event: MouseEvent
    ) => {
      if (selected) {
        if (!event.shiftKey) {
          this._model.deselectAll();
        }
        this._model.selectDef(defSelection);
      } else {
        this._model.deselectDef(defSelection);
      }
    };
    this._defMarkers.push(
      new DefMarker(
        marker,
        editor,
        def,
        def.location,
        def.statement,
        editorDef.cell,
        clickHandler
      )
    );
  }

  highlightOutput(output: CellOutput) {
    let selection = { cell: output.cell, outputIndex: output.outputIndex };
    let outputMarker = new OutputMarker(
      output.element,
      output.outputIndex,
      output.cell,
      (selected, event: MouseEvent) => {
        if (selected) {
          if (!event.shiftKey) {
            this._model.deselectAll();
          }
          this._model.selectOutput(selection);
        } else {
          this._model.deselectOutput(selection);
        }
        if (event.shiftKey) {
          // Don't select cells or text when multiple outputs are clicked on
          event.preventDefault();
          event.stopPropagation();
          clearSelectionsInWindow();
        }
      }
    );
    this._outputMarkers.push(outputMarker);
  }

  /**
   * Clear all def markers that belong to this editor.
   */
  clearSelectablesForCell(cell: IGatherCell) {
    this._model.removeEditorDefsForCell(cell.executionEventId);
    this._model.deselectOutputsForCell(cell.executionEventId);
  }

  /**
   * Highlight all of the definitions in an editor.
   */
  highlightDefs(editor: CodeMirror.Editor, cell: IGatherCell) {
    /**
     * Fetch the cell program instead of recomputing it, as it can stall the interface if we
     * analyze the code here.
     */
    let cellProgram = this._model.getCellProgram(cell);
    if (cellProgram !== null && !cellProgram.hasError) {
      for (let ref of cellProgram.defs) {
        if (ref.type == SymbolType.VARIABLE) {
          this._model.addEditorDef({ def: ref, editor: editor, cell: cell });
        }
      }
    }
    log('Highlighted definitions', { numActive: this._defMarkers.length });
  }

  /**
   * Highlight a list of output elements.
   */
  highlightOutputs(cell: IGatherCell, outputElements: HTMLElement[]) {
    for (let i = 0; i < outputElements.length; i++) {
      let outputElement = outputElements[i];
      let output = { cell: cell, element: outputElement, outputIndex: i };
      this._model.addOutput(output);
    }
    log('Highlighted outputs', { numActive: this._outputMarkers.length });
  }

  /**
   * Highlight dependencies in a cell at a set of locations.
   */
  highlightDependencies(slice: SlicedExecution) {
    let defLines: number[] = [];
    slice.cellSlices.forEach(cellSlice => {
      let loggedCell = cellSlice.cell;
      let sliceLocations = cellSlice.slice;
      let liveCellWidget = this._elementFinder.getCellWidget(loggedCell);
      let editor = this._elementFinder.getEditor(loggedCell);

      if (liveCellWidget && editor) {
        let liveCell = new LabCell(liveCellWidget.model as ICodeCellModel);
        let numLines = 0;
        // Batch the highlight operations for each cell to spend less time updating cell height.
        editor.operation(() => {
          sliceLocations.items.forEach((loc: ILocation) => {
            for (
              let lineNumber = loc.first_line - 1;
              lineNumber <= loc.last_line - 1;
              lineNumber++
            ) {
              numLines += 1;
              let styleClass = liveCell.dirty
                ? DIRTY_DEPENDENCY_CLASS
                : DEPENDENCY_CLASS;
              let lineHandle = editor.addLineClass(
                lineNumber,
                'background',
                styleClass
              );
              this._dependencyLineMarkers.push({
                editor: editor,
                lineHandle: lineHandle,
              });
            }
          });
          defLines.push(numLines);
        });
      }
    });
    log('Added lines for defs (may be overlapping)', { defLines });
  }

  private _clearDependencyMarkersForLine(
    editor: CodeMirror.Editor,
    lineHandle: CodeMirror.LineHandle
  ) {
    editor.removeLineClass(lineHandle, 'background', DEPENDENCY_CLASS);
    editor.removeLineClass(lineHandle, 'background', DIRTY_DEPENDENCY_CLASS);
  }

  private _updateDependenceHighlightsForCell(cell: IGatherCell) {
    let editor = this._elementFinder.getEditor(cell);
    let liveCellWidget = this._elementFinder.getCellWidget(cell);
    let liveCell = new LabCell(liveCellWidget.model as ICodeCellModel);
    this._dependencyLineMarkers
      .filter(marker => marker.editor == editor)
      .forEach(marker => {
        this._clearDependencyMarkersForLine(marker.editor, marker.lineHandle);
        let styleClass = liveCell.dirty
          ? DIRTY_DEPENDENCY_CLASS
          : DEPENDENCY_CLASS;
        marker.editor.addLineClass(marker.lineHandle, 'background', styleClass);
      });
  }

  private _clearDependencyLineMarkers() {
    log('Cleared all dependency line markers');
    this._dependencyLineMarkers.forEach(marker => {
      this._clearDependencyMarkersForLine(marker.editor, marker.lineHandle);
    });
    this._dependencyLineMarkers = [];
  }
}

type DependencyLineMarker = {
  editor: CodeMirror.Editor;
  lineHandle: CodeMirror.LineHandle;
};

/**
 * Marker for an output.
 */
class OutputMarker {
  constructor(
    outputElement: HTMLElement,
    outputIndex: number,
    cell: IGatherCell,
    onToggle: (selected: boolean, event: MouseEvent) => void
  ) {
    this._element = outputElement;
    this._element.classList.add(OUTPUT_HIGHLIGHTED_CLASS);
    this._addSelectionButton();
    this.outputIndex = outputIndex;
    this.cell = cell;
    this._onToggle = onToggle;

    this._clickListener = (event: MouseEvent) => {
      let target = event.target as HTMLElement;
      // If the click is on a child of the output area (the actual content), then handle
      // that click event like normal without selecting the output.
      if (
        !target ||
        !(
          target.classList.contains(OUTPUT_HIGHLIGHTED_CLASS) ||
          target.classList.contains(OUTPUT_GATHER_BUTTON_CLASS) ||
          target.classList.contains(OUTPUT_GATHER_LABEL_CLASS)
        )
      )
        return;
      if (this._onToggle) {
        this._toggleSelected();
        this._onToggle(this._selected, event);
      }
      log('Clicked on output area', {
        outputIndex,
        cell,
        toggledOn: this._selected,
      });
    };
    this._element.addEventListener('click', this._clickListener);
  }

  private _addSelectionButton() {
    this._gatherButton = new Widget({ node: document.createElement('div') });
    this._gatherButton.addClass(OUTPUT_GATHER_BUTTON_CLASS);
    this._gatherButton.layout = new PanelLayout();

    this._gatherLabel = new Widget({ node: document.createElement('p') });
    this._gatherLabel.addClass(OUTPUT_GATHER_LABEL_CLASS);
    this._gatherLabel.node.textContent = 'Gather';
    (this._gatherButton.layout as PanelLayout).addWidget(this._gatherLabel);

    this._element.appendChild(this._gatherButton.node);
  }

  private _toggleSelected() {
    if (this._selected) this.deselect();
    else if (!this._selected) this.select();
  }

  select() {
    this._selected = true;
    this._element.classList.add(OUTPUT_SELECTED_CLASS);
  }

  deselect() {
    this._selected = false;
    this._element.classList.remove(OUTPUT_SELECTED_CLASS);
  }

  destroy() {
    this.deselect();
    this._element.classList.remove(OUTPUT_HIGHLIGHTED_CLASS);
    this._element.removeEventListener('click', this._clickListener);
  }

  readonly outputIndex: number;
  readonly cell: IGatherCell;
  private _element: HTMLElement;
  private _gatherButton: Widget;
  private _gatherLabel: Widget;
  private _clickListener: (_: MouseEvent) => void;
  private _onToggle: (selected: boolean, event: MouseEvent) => void;
  private _selected: boolean = false;
}

/**
 * Line handle for a definition line.
 */
type DefLineHandle = {
  def: Ref;
  lineHandle: LineHandle;
};

/**
 * Marker for a variable definition.
 */
class DefMarker {
  constructor(
    marker: CodeMirror.TextMarker,
    editor: CodeMirror.Editor,
    def: Ref,
    location: ILocation,
    statement: ISyntaxNode,
    cell: IGatherCell,
    clickHandler: (
      cell: IGatherCell,
      selection: ILocation,
      selected: boolean,
      event: MouseEvent
    ) => void
  ) {
    this.marker = marker;
    this.def = def;
    this.editor = editor;
    this.location = location;
    this.statement = statement;
    this.cell = cell;
    this.clickHandler = clickHandler;
  }

  handleClick(event: MouseEvent) {
    let editor = this.editor;
    if (editor.getWrapperElement().contains(event.target as Node)) {
      // In Chrome, if you click in the top of an editor's text area, it will trigger this
      // event, and is considered as a click at the start of the box. This filter for
      // span elements filters out those spurious clicks.
      let target = event.target as HTMLElement;
      let badTarget =
        !target.tagName ||
        target.tagName != 'SPAN' ||
        !target.classList.contains(DEFINITION_CLASS);
      if (badTarget) return;
      let clickPosition: CodeMirror.Position = editor.coordsChar({
        left: event.clientX,
        top: event.clientY,
      });
      let editorMarkers = editor.getDoc().findMarksAt(clickPosition);
      if (editorMarkers.indexOf(this.marker) != -1) {
        if (this.clickHandler) {
          this.toggleSelected();
          log('Clicked on definition', {
            toggledOn: this._selected,
            cell: this.cell,
          });
          this.clickHandler(this.cell, this.location, this._selected, event);
        }
        event.preventDefault();
      }
    }
  }

  toggleSelected() {
    if (this._selected) this.deselect();
    else if (!this._selected) this.select();
  }

  select() {
    this._selected = true;
    let markerPos = this.marker.find();
    this._selectionMarker = this.editor
      .getDoc()
      .markText(markerPos.from, markerPos.to, {
        className: DEFINITION_SELECTED_CLASS,
      });
  }

  deselect() {
    this._selected = false;
    if (this._selectionMarker) {
      this._selectionMarker.clear();
      this._selectionMarker = undefined;
    }
  }

  private _selected: boolean = false;
  private _selectionMarker: CodeMirror.TextMarker = undefined;
  readonly marker: CodeMirror.TextMarker;
  readonly editor: CodeMirror.Editor;
  readonly def: Ref;
  readonly location: ILocation;
  readonly statement: ISyntaxNode;
  readonly cell: IGatherCell;
  readonly clickHandler: (
    cell: IGatherCell,
    selection: ILocation,
    selected: boolean,
    event: MouseEvent
  ) => void;
}
