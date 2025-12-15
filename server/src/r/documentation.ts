// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * R function documentation for hover support.
 * This provides basic documentation for common R functions and keywords.
 */

export interface RFunctionDoc {
  name: string;
  signature: string;
  description: string;
  returnValue?: string;
  examples?: string[];
}

/**
 * Documentation for common R base functions
 */
export const R_BASE_FUNCTIONS: Record<string, RFunctionDoc> = {
  mean: {
    name: "mean",
    signature: "mean(x, trim = 0, na.rm = FALSE, ...)",
    description: "Generic function for the (trimmed) arithmetic mean.",
    returnValue: "The arithmetic mean of the values in x",
    examples: ["mean(1:10)", "mean(c(1, 2, 3, NA), na.rm = TRUE)"],
  },
  sum: {
    name: "sum",
    signature: "sum(..., na.rm = FALSE)",
    description: "Returns the sum of all the values present in its arguments.",
    returnValue: "The sum of all values",
    examples: ["sum(1:10)", "sum(c(1, 2, 3, NA), na.rm = TRUE)"],
  },
  length: {
    name: "length",
    signature: "length(x)",
    description:
      "Get or set the length of vectors (including lists) and factors, and of any other R object for which a method has been defined.",
    returnValue: "Integer length of x",
    examples: ["length(1:10)", "length(c('a', 'b', 'c'))"],
  },
  print: {
    name: "print",
    signature: "print(x, ...)",
    description:
      "Prints its argument and returns it invisibly (via invisible(x)).",
    returnValue: "Returns x invisibly",
    examples: ["print('Hello, World!')", "print(data.frame(x = 1:5))"],
  },
  c: {
    name: "c",
    signature: "c(..., recursive = FALSE, use.names = TRUE)",
    description: "Combines values into a vector or list.",
    returnValue: "A vector or list",
    examples: ["c(1, 2, 3)", "c('a', 'b', 'c')"],
  },
  seq: {
    name: "seq",
    signature: "seq(from = 1, to = 1, by, length.out, along.with, ...)",
    description: "Generate regular sequences.",
    returnValue: "A vector of type integer or numeric",
    examples: [
      "seq(1, 10)",
      "seq(1, 10, by = 2)",
      "seq(0, 1, length.out = 11)",
    ],
  },
  rep: {
    name: "rep",
    signature: "rep(x, times = 1, length.out, each, ...)",
    description: "Replicates the values in x.",
    returnValue: "A vector of replicated values",
    examples: ["rep(1:3, times = 2)", "rep(1:3, each = 2)"],
  },
  "data.frame": {
    name: "data.frame",
    signature:
      "data.frame(..., row.names = NULL, check.rows = FALSE, check.names = TRUE, fix.empty.names = TRUE, stringsAsFactors = FALSE)",
    description:
      "Creates data frames, tightly coupled collections of variables which share many of the properties of matrices and of lists.",
    returnValue: "A data frame",
    examples: [
      "data.frame(x = 1:5, y = letters[1:5])",
      "data.frame(name = c('Alice', 'Bob'), age = c(25, 30))",
    ],
  },
  subset: {
    name: "subset",
    signature: "subset(x, subset, select, drop = FALSE, ...)",
    description:
      "Returns subsets of vectors, matrices or data frames which meet conditions.",
    returnValue: "A subset of x",
    examples: [
      "subset(mtcars, mpg > 20)",
      "subset(iris, Species == 'setosa', select = c(Sepal.Length, Sepal.Width))",
    ],
  },
  summary: {
    name: "summary",
    signature: "summary(object, ...)",
    description:
      "Generic function used to produce result summaries of the results of various model fitting functions.",
    returnValue: "Summary statistics",
    examples: ["summary(1:10)", "summary(data.frame(x = 1:100))"],
  },
  str: {
    name: "str",
    signature: "str(object, ...)",
    description: "Compactly display the internal structure of an R object.",
    returnValue: "NULL (prints to console)",
    examples: ["str(iris)", "str(list(a = 1:3, b = 'hello'))"],
  },
  head: {
    name: "head",
    signature: "head(x, n = 6L, ...)",
    description:
      "Returns the first or last parts of a vector, matrix, table, data frame or function.",
    returnValue: "First n elements of x",
    examples: ["head(iris)", "head(1:100, 10)"],
  },
  tail: {
    name: "tail",
    signature: "tail(x, n = 6L, ...)",
    description:
      "Returns the first or last parts of a vector, matrix, table, data frame or function.",
    returnValue: "Last n elements of x",
    examples: ["tail(iris)", "tail(1:100, 10)"],
  },
  nrow: {
    name: "nrow",
    signature: "nrow(x)",
    description: "Returns the number of rows present in x.",
    returnValue: "Integer number of rows",
    examples: ["nrow(iris)", "nrow(mtcars)"],
  },
  ncol: {
    name: "ncol",
    signature: "ncol(x)",
    description: "Returns the number of columns present in x.",
    returnValue: "Integer number of columns",
    examples: ["ncol(iris)", "ncol(mtcars)"],
  },
  dim: {
    name: "dim",
    signature: "dim(x)",
    description: "Retrieve or set the dimension of an object.",
    returnValue: "Integer vector of dimensions",
    examples: ["dim(matrix(1:9, 3, 3))", "dim(iris)"],
  },
  names: {
    name: "names",
    signature: "names(x)",
    description: "Get or set the names of an object.",
    returnValue: "Character vector of names",
    examples: ["names(iris)", "names(c(a = 1, b = 2, c = 3))"],
  },
  class: {
    name: "class",
    signature: "class(x)",
    description: "Returns the class attribute of an object.",
    returnValue: "Character vector of class names",
    examples: ["class(1:10)", "class(data.frame())"],
  },
  typeof: {
    name: "typeof",
    signature: "typeof(x)",
    description:
      "Determines the (R internal) type or storage mode of any object.",
    returnValue: "Character string giving the type",
    examples: ["typeof(1:10)", "typeof('hello')"],
  },
  "is.numeric": {
    name: "is.numeric",
    signature: "is.numeric(x)",
    description: "Tests if an object is numeric.",
    returnValue: "TRUE or FALSE",
    examples: ["is.numeric(1:10)", "is.numeric('hello')"],
  },
  "is.character": {
    name: "is.character",
    signature: "is.character(x)",
    description: "Tests if an object is of type character.",
    returnValue: "TRUE or FALSE",
    examples: ["is.character('hello')", "is.character(1:10)"],
  },
  "as.numeric": {
    name: "as.numeric",
    signature: "as.numeric(x, ...)",
    description: "Attempts to coerce its argument to numeric type.",
    returnValue: "Numeric vector",
    examples: ["as.numeric('123')", "as.numeric(c('1', '2', '3'))"],
  },
  "as.character": {
    name: "as.character",
    signature: "as.character(x, ...)",
    description: "Attempts to coerce its argument to character type.",
    returnValue: "Character vector",
    examples: ["as.character(123)", "as.character(1:5)"],
  },
  "read.csv": {
    name: "read.csv",
    signature: "read.csv(file, header = TRUE, sep = ',', ...)",
    description:
      "Reads a file in table format and creates a data frame from it.",
    returnValue: "Data frame",
    examples: ["read.csv('data.csv')", "read.csv('file.csv', header = FALSE)"],
  },
  "write.csv": {
    name: "write.csv",
    signature: "write.csv(x, file = '', ...)",
    description: "Writes a data frame to a CSV file.",
    returnValue: "NULL (writes to file)",
    examples: [
      "write.csv(iris, 'iris.csv')",
      "write.csv(mtcars, 'cars.csv', row.names = FALSE)",
    ],
  },
  plot: {
    name: "plot",
    signature: "plot(x, y, ...)",
    description: "Generic function for plotting of R objects.",
    returnValue: "NULL (creates plot)",
    examples: ["plot(1:10)", "plot(x = mtcars$wt, y = mtcars$mpg)"],
  },
  hist: {
    name: "hist",
    signature: "hist(x, breaks, ...)",
    description: "Computes a histogram of the given data values.",
    returnValue: "Object of class 'histogram'",
    examples: ["hist(rnorm(1000))", "hist(iris$Sepal.Length, breaks = 20)"],
  },
  boxplot: {
    name: "boxplot",
    signature: "boxplot(x, ...)",
    description:
      "Produces box-and-whisker plot(s) of the given (grouped) values.",
    returnValue: "List with plot statistics",
    examples: [
      "boxplot(iris$Sepal.Length)",
      "boxplot(Sepal.Length ~ Species, data = iris)",
    ],
  },
  barplot: {
    name: "barplot",
    signature: "barplot(height, ...)",
    description: "Creates a bar plot with vertical or horizontal bars.",
    returnValue: "Numeric vector of bar midpoints",
    examples: ["barplot(c(2, 5, 3, 7))", "barplot(table(iris$Species))"],
  },
  rnorm: {
    name: "rnorm",
    signature: "rnorm(n, mean = 0, sd = 1)",
    description: "Generates random deviates from the normal distribution.",
    returnValue: "Numeric vector of random values",
    examples: ["rnorm(10)", "rnorm(100, mean = 50, sd = 10)"],
  },
  runif: {
    name: "runif",
    signature: "runif(n, min = 0, max = 1)",
    description: "Generates random deviates from the uniform distribution.",
    returnValue: "Numeric vector of random values",
    examples: ["runif(10)", "runif(100, min = -10, max = 10)"],
  },
  apply: {
    name: "apply",
    signature: "apply(X, MARGIN, FUN, ...)",
    description:
      "Returns a vector or array or list of values obtained by applying a function to margins of an array or matrix.",
    returnValue: "Vector, array or list",
    examples: [
      "apply(matrix(1:9, 3, 3), 1, sum)",
      "apply(iris[,1:4], 2, mean)",
    ],
  },
  lapply: {
    name: "lapply",
    signature: "lapply(X, FUN, ...)",
    description: "Applies a function over a list or vector and returns a list.",
    returnValue: "List of same length as X",
    examples: [
      "lapply(1:3, function(x) x^2)",
      "lapply(list(a = 1:5, b = 6:10), mean)",
    ],
  },
  sapply: {
    name: "sapply",
    signature: "sapply(X, FUN, ..., simplify = TRUE, USE.NAMES = TRUE)",
    description:
      "Applies a function over a list or vector and simplifies the result.",
    returnValue: "Vector, matrix or list",
    examples: ["sapply(1:3, function(x) x^2)", "sapply(iris[,1:4], mean)"],
  },
  function: {
    name: "function",
    signature: "function(arglist) expr",
    description: "Creates a function with the specified arguments and body.",
    returnValue: "A function object",
    examples: [
      "square <- function(x) x^2",
      "add <- function(a, b) { return(a + b) }",
    ],
  },
  if: {
    name: "if",
    signature: "if (condition) expr1 else expr2",
    description: "Conditional execution of code.",
    returnValue: "Result of evaluated expression",
    examples: [
      "if (x > 0) 'positive' else 'non-positive'",
      "if (condition) { do_something() }",
    ],
  },
  for: {
    name: "for",
    signature: "for (var in seq) expr",
    description:
      "Loops over a sequence and executes an expression for each element.",
    returnValue: "NULL (side effects only)",
    examples: [
      "for (i in 1:10) print(i)",
      "for (name in names(iris)) print(name)",
    ],
  },
  while: {
    name: "while",
    signature: "while (condition) expr",
    description: "Repeatedly executes an expression while a condition is true.",
    returnValue: "NULL (side effects only)",
    examples: ["i <- 1; while (i <= 10) { print(i); i <- i + 1 }"],
  },
  library: {
    name: "library",
    signature: "library(package, ...)",
    description: "Loads and attaches add-on packages.",
    returnValue: "NULL (loads package)",
    examples: ["library(ggplot2)", "library('dplyr')"],
  },
  require: {
    name: "require",
    signature: "require(package, ...)",
    description:
      "Loads and attaches add-on packages (returns FALSE if not available).",
    returnValue: "TRUE if successful, FALSE otherwise",
    examples: ["require(ggplot2)", "if (require(dplyr)) { ... }"],
  },
};

/**
 * R keywords documentation
 */
export const R_KEYWORDS: Record<string, RFunctionDoc> = {
  TRUE: {
    name: "TRUE",
    signature: "TRUE",
    description: "Logical constant representing true.",
    returnValue: "Logical TRUE",
  },
  FALSE: {
    name: "FALSE",
    signature: "FALSE",
    description: "Logical constant representing false.",
    returnValue: "Logical FALSE",
  },
  NULL: {
    name: "NULL",
    signature: "NULL",
    description: "The null object representing the absence of a value.",
    returnValue: "NULL",
  },
  NA: {
    name: "NA",
    signature: "NA",
    description: "Logical constant indicating missing value.",
    returnValue: "Logical NA",
  },
  NaN: {
    name: "NaN",
    signature: "NaN",
    description: "Numeric constant representing 'Not a Number'.",
    returnValue: "Numeric NaN",
  },
  Inf: {
    name: "Inf",
    signature: "Inf",
    description: "Numeric constant representing positive infinity.",
    returnValue: "Numeric Inf",
  },
  return: {
    name: "return",
    signature: "return(value)",
    description: "Returns a value from a function.",
    returnValue: "The specified value",
  },
  break: {
    name: "break",
    signature: "break",
    description: "Breaks out of a for, while, or repeat loop.",
    returnValue: "NULL",
  },
  next: {
    name: "next",
    signature: "next",
    description: "Skips to the next iteration of a loop.",
    returnValue: "NULL",
  },
};

/**
 * Get documentation for an R function or keyword
 */
export function getRDocumentation(symbol: string): RFunctionDoc | undefined {
  return R_BASE_FUNCTIONS[symbol] || R_KEYWORDS[symbol];
}

/**
 * Format documentation as markdown for hover display
 */
export function formatRDocAsMarkdown(doc: RFunctionDoc): string {
  const parts: string[] = [];

  parts.push(`### ${doc.name}`);
  parts.push("");
  parts.push(`\`\`\`r\n${doc.signature}\n\`\`\``);
  parts.push("");
  parts.push(doc.description);

  if (doc.returnValue) {
    parts.push("");
    parts.push(`**Returns:** ${doc.returnValue}`);
  }

  if (doc.examples && doc.examples.length > 0) {
    parts.push("");
    parts.push("**Examples:**");
    parts.push("```r");
    parts.push(doc.examples.join("\n"));
    parts.push("```");
  }

  return parts.join("\n");
}
