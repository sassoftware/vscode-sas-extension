%let danal=anal;

data ___&danal.;
run;

data _null_;
  set sashelp.class(obs=1);
run;
