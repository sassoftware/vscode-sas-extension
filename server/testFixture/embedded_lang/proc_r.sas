proc r;
submit;
    for (x in 1:6) {
      print(x)
    }
    print("first statement after for loop")
endsubmit;
run;
