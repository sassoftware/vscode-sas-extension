---
sidebar_position: 7
---

# SAS Code Editing Features

## SAS Syntax Highlighting

The SAS extension highlights these syntax elements in your program, just as they would appear in a SAS editor:

- Global statements
- SAS procedures
- SAS procedure statements
- Data step definition
- Data step statements
- SAS data sets
- Macro definition
- Macro statements
- Functions
- CALL routines
- Formats and informats
- Macro variables
- SAS colors
- Style elements and style attributes
- Comment
- Various constants
- Options, enumerated option values, sub-options and sub-option values for various procedure definitions and statements

## Color Themes

You can choose among three SAS-related color themes that control the color of the application and syntax elements. The SAS Light, SAS Dark and SAS High Contrast options mirror the themes available in SAS Studio.

To specify the color theme:

- Select `File > Preferences > Color Theme` and select the theme, by name. The image below demonstrates the process changing from SAS Light to SAS Dark.

![vsCodeChangeTheme2](/images/vsCodeChangeTheme2.gif)

## Code Completion

The SAS extension includes automatic code completion and pop-up syntax help for SAS keywords. The autocomplete, or code completion, feature in the code editor can predict the next word that you want to enter in your SAS program. See code completion in action below.

![vsCodeTypeAhead](/images/vsCodeTypeAhead.gif)

To use the autocomplete feature:

- Start typing a valid SAS keyboard. Scroll through the pop-up list of suggested keywords by using your mouse or the up and down arrow keys.

## Pop-up Syntax Help

The syntax help gets you started with a hint about the syntax or a brief description of the keyword. You can get additional help by clicking the links in the syntax help window.

To view the syntax help:

- Move the mouse pointer over a valid SAS keyword in the code.

In the following example, the help panel displays syntax help for the DATA= option in the PROC PRINT statement.

![vsCodeSyntaxAssist2](/images/vsCodeSyntaxAssist2.gif)

:::tip

Click the links in the syntax help window to navigate to the SAS online help.

:::

## Snippets

Snippets are lines of commonly used code or text that you can insert into your program. The SAS extension includes snippets for SAS functions and procedures to facilitate writing your SAS programs.

To access the list of snippets for a function or procedure:

- Type the name of a function or procedure in your SAS program. This example shows a snippet for the PROC DS2.

![vsCodeSnippets](/images/vsCodeSnippets.gif)

## Code Folding and Code Outline

Regions of code are identified in your SAS program as blocks of code that can be collapsed and expanded. You can also view an outline of your program that identifies DATA steps, procedures, macro sections, and user-defined regions of code.

![vsCodeFoldAndOutline](/images/vsCodeFoldAndOutline.gif)

:::tip

You can define a custom region by adding `/*region*/` and `/*endregion*/` tags to the start and end of the block of code.

:::

![vsCodeRegionFunction](/images/vsCodeRegionFunction.gif)

## Code Formatting

To format your code, open context menu and select `Format Document`.

![formatter](/images/formatter.gif)

:::tip

You can define custom regions as below to exclude code from being formatted.

```sas
proc format library=library;
/* region format-ignore */
  invalue evaluation 'O'=4
                     'S'=3
                     'E'=2
                     'C'=1
                     'N'=0;
/* endregion */
run;
```

:::

## Function Signature Help

Signature help provides information for current parameter as you are writing function calls.

![signatureHelp](/images/signatureHelp.gif)
