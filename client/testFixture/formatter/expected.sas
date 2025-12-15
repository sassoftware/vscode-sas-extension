options ls=72;
%let a=%nrquote(%nrstr(test%'s     message;));

data _null_;
  input name=$ / 1-8 $10. @ @15 @@ @(b*3) @weekday #2 +5 4. ? ?? name=$ / 1-8
    $10. @ @15 @@ @(b*3) @weekday #2 +5 4. ? ??;
  cards;
1  AA  2
3  BB  4
;

data a;
  cards4;
1  AA  2
3  BB  4
;;;;
  datalines4;
1  AA  2
3  BB  4
;;;;

  title 'a';
  title 'a';

/* leading comment */
proc catalog;
  contents out=a; /* trailing comment */
  run;
  copy out=a;
  run;
quit;

data new;
  date='06MAY98';
  month=substr(date, 3, 3);
  year=substr(date, 6, 2);
  put month= year=;
run;

proc python terminate;
submit;
#Reference to variable defined in previous PROC PYTHON call
print("x = " + x)
def my_function():
    print("Inside the proc step")
endsubmit;
run;

proc rlang;
submit;
# Reference to variable defined in previous PROC RLANG call
print(paste("x =", x))
my_function <- function() {
    print("Inside the proc step")
}
endsubmit;
run;

proc lua;
submit;
local dsid = sas.open("sashelp.company") -- open for input            

-- Iterate over the variables in the data set
for var in sas.vars(dsid) do
    vars[var.name:lower()] = var               
end

sas.close(dsid)
endsubmit;
run;

proc template;
  define statgraph barline;
    begingraph;
      entrytitle "Overlay of REFERENCELINE, BARCHARTPARM and SERIESPLOT";
      layout overlay;
        referenceline y=25000000 / curvelabel="Target";
        barchartparm category=year response=retail / dataskin=matte
          fillattrs=(transparency=0.5) fillpatternattrs=(pattern=R1
          color=lightgray);
        seriesplot x=year y=profit / name="series";
        discretelegend "series";
      endlayout;
    endgraph;
  end;
run;

proc ds2 libs=work;
  data _null_;
    method init();
      dcl varchar(16) str;
      str='Hello World!';
      put str;
    end;
  enddata;
  run;
quit;

%macro reportit(request);
  %if %upcase(&request)=STAT %then %do;
    proc means;
      title "Summary of All Numeric Variables";
    run;
  %end;
  %else %if %upcase(&request)=PRINTIT %then %do;
    proc print;
      title "Listing of Data";
    run;
  %end;
  %else %put Incorrect report type. Please try again.;
  title;
%mend reportit;

*region;
%macro;
  *region;
  data _null_;
    *region;
    /** a block comment
     * additional comment line
     */
    do i=2 to 20 by 2 until((x/3)>y);
mylabel:
      do x=1, 2, 3 while (x=2);
        a=0;
      end;
    end;
    *endregion;
  *endregion;
%mend;
*endregion;
%test

proc python;
interactive;
fruits = ["apple", "banana", "cherry"]
for x in fruits:
   print(x)

print('first statement after for loop')
endinteractive;
run;

proc rlang;
submit;
fruits <- c("apple", "banana", "cherry")
for (x in fruits) {
   print(x)
}

print('first statement after for loop')
endsubmit;
run;

proc lua;
submit;

    local rc

    local code = [[
        data sample; set answer;
        where CCUID = @ccuid@;
        y = @subValue@;
        run;
    ]]

    rc = sas.submit(code, {ccuid="67", subValue=72})

endsubmit;
run;

proc lua;
submit;
   if (sas.exists("work.homes")) then
      local t = sas.read_ds("work.homes")
      i=1
      while(t[i] ~= nil) do
         print("Obs #" .. i)
         for k,v in pairs(t[i]) do 
             print(k,v) 
         end
         print("\n")
         i = i+1
      end
   end
endsubmit;
run;

proc python;
/* comment */
i;
print('hello')
endinteractive;
  /* comment */
run;

proc format library=library;
/* region format-ignore */
  invalue evaluation 'O'=4
                     'S'=3
                     'E'=2
                     'C'=1
                     'N'=0;
/* endregion */
run;
