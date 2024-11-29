# Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

class SAS:
   """
   This module provides the interface from the Python process to Proc Python in
   the SAS process. It provides user callable methods for interacting with the
   SAS process it's attached to.
   """

   workpath: str
   """string containing the WORK libref's filesystem path, including the trailing slash."""

   def hideLOG(self, tf: bool) -> None:
      """
      This methods identifies whether the SAS LOG output for the data transfer methods, sd2df()
      and df2sd() is written or cached to a file. Since it's the Python log, and there's a lot
      of SAS code and messages that those methods generate, the default is to not see all
      of that cluttering up the Python log you're seeing. But, for diagnosing problems, having
      that shown can be helpful. When set to True (default), the contents of the SAS LOG for
      those methods is cached, and you can see it at any time using the printLOG() method, or
      clear the current contents of the cache file using clearLOG().

      :param tf: boolean default True. Whether to hide the LOG output for data transfer routines

      :return: None
      """

   def printLOG(self, method='SAS') -> None:
      """
      This methods renders the parts of the SAS LOG output that were hidden from the data
      transfer routines sd2df() and df2sd(), based upon the setting of hideLOG() which
      defaults to True.

      :param method: the default value 'SAS' uses SAS to write the output to the SAS LOG which allows
                     for proper coloring of the output in Studio and also shows up before the Python
                     output when in 'submit' processing.
                     The value 'Python' uses Python to write the output to the Python log, which
                     shows up in the SAS LOG without coloring and in the Python output where the method
                     was executed, regardless of using 'submit' or 'interactive'.


      :return: None
      """

   def clearLOG(self) -> None:
      """
      This method will delete all of the currently cached LOG output, if any. Subsequent output
      from data transfer methods will continue to cache their output, if set to hide that output,
      based upon the setting of hideLOG()

      :return: None
      """

   def submit(self, code: str) -> int:
      """
      This methods submits the code you provide back into the existing SAS session, recursively
      executing it while still within the PROC PYTHON that is running this method.

      :param code: string of SAS code to submit

      :return: None
      """

   def symget(self, name: str) -> str:
      """
      This methods retrieves the value for the macro variable who's name you provided. It returns
      the string value. If the value represents a numeric type, you can simply cast it to what type
      you like.

      :param name: string of SAS macro variable name

      :return: str
      """

   def symput(self, name: str, val: str) -> int:
      """
      This methods assigns a macro variable in SAS with the name and value you provide.

      :param name: string of SAS macro variable name
      :param val:  value to assign, which will be converted to a string, as that's what macro
                   variable in SAS are

      :return: int
      """

   def pyplot(self, plot: object, filename: str = None, filepath: str = None,
                    filetype: str='svg', **kwargs) -> None:
      """
      This methods renders a matplot.pyplot object, or other plot object that supports pyplot's
      savefig() method. It simply calls savefig() writing the plot to one of the supported ODS types
      and submits the SAS code to render that file using ODS.

      :param plot:     the plot object; pyplot or equivalent supporting the same savefig() method
      :param filename: name of the file to create, defaults to 'matplot'
      :param filepath: directory path to write the file; defaults to the work library
      :param filetype: file type to create; defaults to 'svg'. This is passed to savefig via format=filetype
      :param kwargs:   kwargs passed to the savefig() method

      :return: None
      """

   def renderImage(self, filename: str) -> None:
      """
      This method renders a plot that has already been written to a file, so you
      can render plots from any plotting object that isn't pyplot or doesn't have the same
      savefig() method as pyplot. You write the plot to a supported ODS file type using that
      objects methods and just call this method to have it rendered.

      :param filename: fully qualified name of the file to render.

      :return: None
      """

   def logMessage(self, message: str, messageType: str = 'NOTE') -> None:
      """
      Writes a well formed message to the SAS Log

      :param message:     {String} - Message that should be written to the SAS log
      :param messageType: {String  - default: NOTE}
                                   - NOTE,    writes a  Note    to the SAS log
                                   - WARNING, writes a  Warning to the SAS log
                                   - ERROR,   writes an Error   to the SAS log

      :return: None

      # Example usage
      SAS.logMessage('test')
      SAS.logMessage('testWarn', 'warning')
      SAS.logMessage('testError', 'error')

      """

   def sasdata2dataframe(self, dataset, rowsep: str = '\x01', colsep: str = '\x02',
                                        rowrep: str = ' ',    colrep: str = ' ', **kwargs):
      """
      See the doc for sd2df(). This is just an alias for that method
      """

   def sd2df(self, dataset, rowsep: str = '\x01', colsep: str = '\x02',
                            rowrep: str = ' ',    colrep: str = ' ', **kwargs):
      """
      This method exports the SAS Data Set to a Pandas DataFrame, returning the DataFrame object.

      :param dataset: the 'libref.table(optional dataset options)' name of the SAS Data Set

      These parameters are not to be used normally. Don't use them without instruction.

      :param rowsep:  the row separator character to use; defaults to hex(1)
      :param colsep:  the column separator character to use; defaults to hex(2)
      :param rowrep:  the char to convert to for any embedded rowsep chars, defaults to  ' '
      :param colrep:  the char to convert to for any embedded colsep chars, defaults to  ' '
      :param errors:  this is the parameter to decode(errors=) when reading the stream of data into pandas and converting
                      from bytes to chars. If the variables in the SAS data set have invalid characters (from truncation or other)
                      then you can provide values like 'replace' or 'ignore' to load the invalid data instead of failing.
      :param kwargs:  these are for internal use and are generally NOT needed.

      :return: Pandas DataFrame
      """

   def dataframe2sasdata(self, df, dataset,
                         LF: str = '\x01', CR: str = '\x02',
                         colsep: str = '\x03', colrep: str = ' ',
                         datetimes: dict={}, outfmts: dict={},
                         labels: dict={}, char_lengths: dict={}, **kwargs):
      """
      See the doc for df2sd(). This is just an alias for that method
      """

   def df2sd(self, df: 'pandas.DataFrame', dataset: str,
             LF: str = '\x01', CR: str = '\x02',
             colsep: str = '\x03', colrep: str = ' ',
             datetimes: dict={}, outfmts: dict={},
             labels: dict={}, char_lengths: dict={}, **kwargs) -> int:
      """
      This method imports a Pandas DataFrame to a SAS Data Set you identify via the `dataset` parameter (libref.table).

      Also note that DataFrame indexes (row label) are not transferred over as columns, as they aren't actually in df.columns.
      You can simply use df.reset_index() before this method and df.set_index() after to have the index be a column which
      is transferred over to the SAS data set. If you want to create a SAS index at the same time, specify that with the
      output dataset options.

      :param df:           Pandas DataFrame to import to a SAS Data Set
      :param dataset:      the 'libref.table(optional output data set options)' name of the SAS Data Set to create
      :param datetimes:    dict with column names as keys and values of 'date' or 'time' to create SAS date or times instead of datetimes
      :param outfmts:      dict with column names and SAS formats to assign to the new SAS data set
      :param labels:       dict with column names and labels to assign to the new SAS data set
      :param char_lengths: a dictionary containing the names:lengths of all of the character columns. This eliminates
                           running the code to calculate the lengths, and goes straight to transferring the data

      These parameters are not to be used normally. Don't use them without instruction.

      :param LF:      the character to use for LF when transferring the data; defaults to hex(1)
      :param CR:      the character to use for CR when transferring the data; defaults to hex(2)
      :param colsep:  the column separator character used for streaming the delimited data to SAS defaults to hex(3)
      :param colrep:  the char to convert to for any embedded colsep, LF, CR chars in the data; defaults to  ' '

      :return: int
      """

   def sasfnc(*arg) -> str:
      """
      This method executes the SAS or FCMP function you provide, returning the results.
      The parameters vary based upon the function being called. But the first parameter
      is the name of the function, followed by the required parameters for that function.

      :param arg[1]:           name of the SAS function to call
      :param arg[2] to arg[n]: arguments to SAS function

      :return: str
      """
