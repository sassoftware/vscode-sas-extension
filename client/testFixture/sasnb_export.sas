/*
# Notebook to SAS Test
*/

/*
## Python Code

This is some Python code
*/

/*
This is a separate note in **Markdown** format.
*/

proc python;
submit;
a, b = 4, 2
print("Result: ", a*10 + b)
endsubmit;
run;

/*
## SAS Code
*/

data work.prdsale;
	set sashelp.PRDSALE;
run;

proc means data=work.prdsale;
run;

/*
## SQL Code
*/

proc sql;
CREATE TABLE WORK.QUERY_PRDSALE AS
    SELECT
        (t1.COUNTRY) LABEL='Country' FORMAT=$CHAR10.,
        (SUM(t1.ACTUAL)) FORMAT=DOLLAR12.2 LENGTH=8 AS SUM_ACTUAL
    FROM
        WORK.PRDSALE t1
    GROUP BY
        t1.COUNTRY;
quit;

/*
A last comment in Markdown at the end of the document
*/

/*

*/
