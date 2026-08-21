proc deepprice;
  /* Case A: true multiline parenthesized sub-option context */
  dnn train=( optimize=);

  /* Case B: quoted parentheses must not break context detection */
  dnn train=( where=")(" );
run;
