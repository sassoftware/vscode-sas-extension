proc rlang;
submit;
    for (x in 1:6) {
      print(x)
      mean(x)
    }
    paste("first statement after for loop")   
endsubmit;
run;
