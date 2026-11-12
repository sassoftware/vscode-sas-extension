%macro addition(a, b);
  %put %eval(&a + &b);
%mend addition;

%add
