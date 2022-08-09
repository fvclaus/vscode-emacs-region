// Copyright (c) 2016 Nisheet Jain
// Released under the MIT license
// https://github.com/nisheetjain/vscode-emacs/blob/master/LICENSE.txt

"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

let inRegionMode = false;

const isSelectionBiggerThan1 = (selection: vscode.Selection | undefined) => {
  if (selection === undefined) {
    return false
  }

  const end: vscode.Position = selection.end;
  const start = selection.start;
  return !start.isEqual(end);
}

type EditorView = "panel" | "editor" | "both" | "unknown";

type PanelSize = "small" | "large";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  setRegionMode(false);


  let panelSize : PanelSize = "small";
  const closePanelAndSidebar = async () => {
    await vscode.commands.executeCommand("workbench.action.closePanel");
    await vscode.commands.executeCommand("workbench.action.closeSidebar");
  }

  let editorView: EditorView | undefined = null;
  let visibleRangesEditor: number | undefined = null;

  let firstRun = false;

  let maxVisibleLines: number | undefined = null;

  let lastRange: vscode.Range | undefined = null;


  await vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
    const foo = true;
    if (foo) {
      return;
    }
    if (lastRange == null) {
      editorView = "editor";
    }
    console.log(e);
    const visibleRange = e.visibleRanges[0];
    const visibleLines = e.visibleRanges[0].end.line - e.visibleRanges[0].start.line;
    const availibleLines = e.textEditor.document.lineCount;

    maxVisibleLines = Math.max(maxVisibleLines, visibleLines);

    const lastVisibleLines = lastRange != null? lastRange.end.line - lastRange.start.line : 0;
    
    console.log("Visible Lines", visibleLines);
    if (visibleRangesEditor == null) {
      visibleRangesEditor = visibleLines;
    }

    if (visibleRange.end.line == (availibleLines - 1)) {
      // Cannot determine view mode screen is not filled.
      console.log(`Cannot determine view. End of file is visible`);
      editorView = "unknown";
    } else {
      if (visibleLines == 0) {
        editorView = "panel";
      } else if (visibleLines < (maxVisibleLines - 5)) {
        editorView = "both";
      } else {
        editorView = "editor";
      } 
      
    }
    
    lastRange = e.visibleRanges[0];


    // const lineCount = e.textEditor.document.lineCount;
    // if (visibleLines == 0 && e.visibleRanges[0].end.line < lineCount) {
    //   editorView = "panel";
    // }
    // else if (visibleLines < (visibleRangesEditor - 5)) {
    //   editorView = "both";
    // } else {
    //   editorView = "editor";
    // }
    console.log(`Editor view is ${editorView}. Max lines is ${maxVisibleLines}`);
  })


  await closePanelAndSidebar();
  editorView = "editor";

  const togglePanel = async(focusCommand: string) => {
    switch(editorView) {
      case "panel": {
        if (panelSize == "large")  {
          await vscode.commands.executeCommand("workbench.action.toggleMaximizedPanel");
          panelSize = "small";
        }
        await vscode.commands.executeCommand("workbench.view.explorer");
        await vscode.commands.executeCommand("workbench.action.problems.focus");
        await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
        editorView = "both";
        break;
      }
      case "both":
      case "editor": {
        await closePanelAndSidebar();
        panelSize = "large";
        await vscode.commands.executeCommand("workbench.action.toggleMaximizedPanel");
        await vscode.commands.executeCommand(focusCommand);
        editorView = "panel";
        break;
      }
      case "unknown": {
        vscode.window.showErrorMessage("Current view is unknown.");
      }
    }
  }


  context.subscriptions.push(
    vscode.commands.registerCommand("emacs.toggleEditor", async () => {
      switch(editorView) {
        case "panel":
        case "both": {
          await closePanelAndSidebar();
          await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
          editorView = "editor";
          break;
        }
        case "editor": {
          if (panelSize == "large") {
            await vscode.commands.executeCommand("workbench.action.toggleMaximizedPanel");
            panelSize = "small";
          }
          await vscode.commands.executeCommand("workbench.view.explorer");
          await vscode.commands.executeCommand("workbench.action.problems.focus");
          await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
          editorView = "both";
          break;
        }
        case "unknown": {
          vscode.window.showErrorMessage("Current view is unknown.");
        }
      }
    }),
    vscode.commands.registerCommand("emacs.toggleTerminal", () => togglePanel("terminal.focus")),
    vscode.commands.registerCommand("emacs.toggleDebugConsole", () => togglePanel("workbench.debug.action.focusRepl"))
  )

  context.subscriptions.push(vscode.commands.registerCommand('emacs.testing.reRunLastRun', async () => {
    await vscode.commands.executeCommand('testing.cancelRun');
    await vscode.commands.executeCommand('testing.reRunLastRun')
  }));

  context.subscriptions.push(vscode.commands.registerCommand('emacs.debug.restart', async () => {
    await vscode.commands.executeCommand('workbench.action.debug.stop');
    await vscode.commands.executeCommand('workbench.action.debug.start')
  }));

  const commands = await vscode.commands.getCommands();



  vscode.window.onDidChangeTextEditorSelection(async (e) => {
    // console.log(e, inRegionMode);
    if (!inRegionMode && isSelectionBiggerThan1(e.selections[0])) {
      const selection = e.selections[0];
      const end: vscode.Position = selection.end;
      const start = selection.start;
      if (!start.isEqual(end)) {
        inRegionMode = true;
        startRegionMode();
      }
    } else if (inRegionMode && !isSelectionBiggerThan1(e.selections[0])) {
      inRegionMode = false;
      exitRegionMode();
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("emacs.startRegionMode", () => {
      startRegionMode();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emacs.exitRegionMode", () => {
      exitRegionMode().then(removeSelection);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emacs.killLine", async () => {
      const activeSelection = vscode.window.activeTextEditor.selection;
      const start = activeSelection.start;
      const document = vscode.window.activeTextEditor.document;
      const workspaceEdit = new vscode.WorkspaceEdit();
      const line = document.lineAt(start);
      const selection = new vscode.Range(start, line.range.end);
      workspaceEdit.replace(document.uri, selection, '');
      const success  = await vscode.workspace.applyEdit(workspaceEdit);
      if (!success) {
        console.warn(`Cannot kill line`);
      }
    })
  );

  var selectionActions: string[] = [
    "action.clipboardCopyAction",
    "action.clipboardPasteAction",
    "action.clipboardCutAction"
  ];
  selectionActions.forEach(selectionAction => {
    context.subscriptions.push(
      vscode.commands.registerCommand("emacs." + selectionAction, () => {
        const activeSelection = vscode.window.activeTextEditor.selection;
        const end: vscode.Position = activeSelection.end;
        const start = activeSelection.start;
        // Don't know why this is necessary. Cuts whole line otherwise.
        if (selectionAction === 'action.clipboardCutAction' && start.isEqual(end)) {
          return;
        }
        const commandExecution = vscode.commands
          .executeCommand("editor." + selectionAction)
          .then(exitRegionMode);
        if (selectionAction === 'action.clipboardCopyAction') {
         commandExecution.then(removeSelection);
        } 
      })
    );
  });
}

function startRegionMode() {
  inRegionMode = true;
  return setRegionMode(true);
}

function exitRegionMode() {
  inRegionMode = false;
  return setRegionMode(false);
}

function setRegionMode(value): Thenable<{}> {
  return vscode.commands.executeCommand("setContext", "inRegionMode", value);
}

function removeSelection() {
  const activeSelection = vscode.window.activeTextEditor.selection;
  const end: vscode.Position = activeSelection.end;
  const start = activeSelection.start;
  if (!start.isEqual(end)) {
    vscode.window.activeTextEditor.selection = new vscode.Selection(end, end);
  }
}

// this method is called when your extension is deactivated
export function deactivate() {
  setRegionMode(false);
}
