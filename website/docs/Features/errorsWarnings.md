---
sidebar_position: 6
---

# Fixing Errors and Warnings

The Problems panel contains error and warning messages that are generated by the SAS log when you run a program. Errors and warnings in the Problems panel are not cleared until you rerun the code. The Quick Fix option enables you to remove items from the Problems panel without rerunning the code.

To use the Quick Fix options:

1. Open the Quick Fix menu in one of these ways:

   - Click a message in the Problems panel and then click the corresponding `Show Code Actions` icon in the code editor.

   - Click the `Show fixes` button for the appropriate message in the Problems panel.

![Quick Fix](/images/quickFix.png)

2. Select one of the following options:

   - `Ignore: current position` - clears the currently selected problem from the Problems panel and the code editor.

   - `Ignore: warnings` - clears all warnings from the Problems panel and the code editor.

   - `Ignore: error` - clears all errors from the Problems panel and the code editor.

   - `Ignore: all` - clears all problems from the Problems panel and the code editor.

:::tip

You can use the Problems panel as a to-do list when you are debugging your code. When you correct an error in your code, open the Quick Fix options for that error and select `Ignore: current position` to remove the error message from the list.

:::