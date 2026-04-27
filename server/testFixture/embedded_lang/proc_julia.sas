proc r;
submit;
    for x in 1:6
      println(x)
    end
    println("first statement after for loop")
endsubmit;
run;