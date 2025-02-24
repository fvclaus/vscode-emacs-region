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

export async function activate(context: vscode.ExtensionContext) {
  setRegionMode(false);


  context.subscriptions.push(
    vscode.commands.registerCommand("emacs.closeAllPanels", async () => {
      await vscode.commands.executeCommand("workbench.action.closePanel");
      await vscode.commands.executeCommand("workbench.action.closeSidebar");
      await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }),
  )

  context.subscriptions.push(vscode.commands.registerCommand('emacs.testing.reRunLastRun', async () => {
    await vscode.commands.executeCommand('testing.cancelRun');
    await vscode.commands.executeCommand('testing.reRunLastRun')
  }));

  context.subscriptions.push(vscode.commands.registerCommand('emacs.debug.restart', async () => {
    await vscode.commands.executeCommand('workbench.action.debug.stop');
    await vscode.commands.executeCommand('workbench.action.debug.start')
  }));

  context.subscriptions.push(vscode.commands.registerCommand("emacs.copyAll", async () => {
    const activeTextEditor = vscode.window.activeTextEditor;
    const lastLine = activeTextEditor.document.lineCount - 1
    activeTextEditor.selection = new vscode.Selection(new vscode.Position(0, 0), activeTextEditor.document.lineAt(lastLine).range.end)
    await vscode.commands.executeCommand("editor.action.clipboardCopyAction");
    removeSelection();
  }));


  vscode.window.onDidChangeTextEditorSelection(async (e) => {
    // console.log(e, inRegionMode);
    if (!inRegionMode && isSelectionBiggerThan1(e.selections[0])) {
      const selection = e.selections[0];
      const end: vscode.Position = selection.end;
      const start = selection.start;
      // Starte regionMode, wenn der Benutzer manuell selektiert
      if (!start.isEqual(end)) {
        inRegionMode = true;
        await startRegionMode();
      }
    } else if (inRegionMode && !isSelectionBiggerThan1(e.selections[0])) {
      inRegionMode = false;
      await exitRegionMode();
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("emacs.startRegionMode", async () => {
      await startRegionMode();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emacs.exitRegionMode", async () => {
      await exitRegionMode().then(removeSelection);
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
      vscode.commands.registerCommand("emacs." + selectionAction, async () => {
        const activeSelection = vscode.window.activeTextEditor.selection;
        const end: vscode.Position = activeSelection.end;
        const start = activeSelection.start;
        // Don't know why this is necessary. Cuts whole line otherwise.
        if (selectionAction === 'action.clipboardCutAction' && start.isEqual(end)) {
          return;
        }
        let commandExecution: Thenable<any> = vscode.commands
          .executeCommand("editor." + selectionAction)
          .then(exitRegionMode);
        if (selectionAction === 'action.clipboardCopyAction') {
         commandExecution = commandExecution.then(removeSelection);
        } 
        await commandExecution;
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
