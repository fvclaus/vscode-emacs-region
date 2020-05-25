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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  setRegionMode(false);

  vscode.window.onDidChangeTextEditorSelection(async (e) => {
    console.log(e, inRegionMode);
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
