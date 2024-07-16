---
sidebar_position: 5
---

# Running SAS Code by Task

## Run selected code or all code in active editor

1. Open the command palette (`F1`, or `Ctrl+Shift+P` on Windows or Linux, or `Shift+CMD+P` on OSX) and execute the `Tasks: Run Task` command.
2. Select the **sas** task category and then select the **sas: Run sas file** task.
3. This task automatically runs selected code or all code in active editor (depending on whether you have selected any code).

## Custom task to run specified SAS file in workspace

1. Open the command palette (`F1`, or `Ctrl+Shift+P` on Windows or Linux, or `Shift+CMD+P` on OSX) and execute the `Tasks: Configure Task` command.
2. Select **sas: Run sas file** task.
3. The `tasks.json` file opens with an initial task definition:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "sas",
      "task": "Run sas file",
      "problemMatcher": [],
      "label": "sas: Run sas file"
    }
  ]
}
```

3. Add the **file** field and assign a SAS file name to it.
4. Update the **label** field. Here is an example of the final task definition:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "sas",
      "task": "Run sas file",
      "file": "my.sas",
      "problemMatcher": [],
      "label": "run my.sas code"
    }
  ]
}
```

5. Save `tasks.json`.
6. This custom task can be run by **Run Tasks...** in the global **Terminal** menu

**Note**:

- If you do not specify a file property or you assign an empty string to the file property in your task definition, the custom task will use the default properties of a built-in task.

## Custom task to run sas code with preamble and postamble added

1. Open the command palette (`F1`, or `Ctrl+Shift+P` on Windows or Linux, or `Shift+CMD+P` on OSX) and execute the `Tasks: Configure Task` command.
2. Select **sas: Run sas file** task.
3. Add **preamble** and/or **postamble** properties and enter the SAS code.
4. if a file is specified, the **preamble** and **postamble** will be added in the code from this file when this task is executed.
5. If **file** is absent, then **preamble** and **postamble** will be added in the selected code (if you have selected code) or all code in active editor when this task is executed.

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "sas",
      "task": "Run sas file",
      "file": "code.sas",
      "preamble": "some code*",
      "postamble": "some code*",
      "problemMatcher": [],
      "label": "Run additional code"
    }
  ]
}
```

## Assigning keyboard shortcuts to tasks

If you need to run a task frequently, you can define a keyboard shortcut for the task.

For example, to assign `Ctrl+H` to the **run additional code** task from above, add the following to your keybindings.json file:

```json
{
  "key": "ctrl+h",
  "command": "workbench.action.tasks.runTask",
  "args": "Run additional code"
}
```
