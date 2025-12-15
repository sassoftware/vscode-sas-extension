proc rlang;
submit;
    for (x in 1:6) {
      print(x)
    }
    print("first statement after for loop")

    die <- 1:6
    paste("Die Maths: ", die[3]*4 + die[6])
endsubmit;
run;
