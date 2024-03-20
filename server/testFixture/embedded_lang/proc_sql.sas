/* comment */
proc sql outobs=2;
  title 'Densities of Countries';
  select name format=$20. from sql.newcountries;

/* comment */
proc sql outobs=2;
  title 'Densities of Countries';
  select name format=$20. from sql.newcountries;
