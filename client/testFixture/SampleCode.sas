options ls=72;
data pf70 pm70 pf80 pm80;
	input state $ pop_f70 pop_m70 pop_f80 pop_m80 @@;
	drop pop_m70 pop_f70 pop_m80 pop_f80;
	decade= 70;
	sex= 'Female';
	pop= pop_f70;  output pf70;
	sex= 'Male';
	pop= pop_m70;  output pm70;
	decade= 80;
	pop= pop_m80;  output pm80;
	sex= 'Female';
	pop= pop_f80;  output pf80;
	cards;
ALA    1.78  1.66  2.02  1.87   ALASKA 0.14  0.16  0.19  0.21
ARIZ   0.90  0.87  1.38  1.34   ARK    0.99  0.93  1.18  1.10
CALIF 10.14  9.82 12.00 11.67   COLO   1.12  1.09  1.46  1.43
CONN   1.56  1.47  1.61  1.50   DEL    0.28  0.27  0.31  0.29
FLA    3.51  3.28  5.07  4.68   GA     2.36  2.23  2.82  2.64
HAW    0.37  0.40  0.47  0.49   IDAHO  0.36  0.36  0.47  0.47
ILL    5.72  5.39  5.89  5.54   IND    2.66  2.53  2.82  2.67
IOWA   1.45  1.37  1.50  1.41   KAN    1.15  1.02  1.21  1.16
KY     1.64  1.58  1.87  1.79   LA     1.87  1.77  2.17  2.04
ME     0.51  0.48  0.58  0.55   MD     2.01  1.92  2.17  2.04
MASS   2.97  2.72  3.01  2.73   MICH   4.53  4.39  4.75  4.52
MINN   1.94  1.86  2.08  2.00   MISS   1.14  1.07  1.31  1.21
MO     2.42  2.26  2.55  2.37   MONT   0.35  0.35  0.39  0.39
NEB    0.76  0.72  0.80  0.77   NEV    0.24  0.25  0.40  0.41
NH     0.38  0.36  0.47  0.45   NJ     3.70  3.47  3.83  3.53
NM     0.52  0.50  0.66  0.64   NY     9.52  8.72  9.22  8.34
NC     2.59  2.49  3.03  2.86   ND     0.31  0.31  0.32  0.33
OHIO   5.49  5.16  5.58  5.22   OKLA   1.31  1.25  1.55  1.48
ORE    1.07  1.02  1.34  1.30   PA     6.13  5.67  6.18  5.68
RI     0.48  0.46  0.50  0.45   SC     1.32  1.27  1.60  1.52
SD     0.34  0.33  0.35  0.34   TENN   2.03  1.90  2.37  2.22
TEXAS  5.72  5.48  7.23  7.00   UTAH   0.54  0.52  0.74  0.72
VT     0.23  0.22  0.26  0.25   VA     2.35  2.30  2.73  2.62
WASH   1.72  1.69  2.08  2.05   W.VA   0.90  0.84  1.00  0.95
WIS    2.25  2.17  2.40  2.31   WYO    0.16  0.17  0.23  0.24
XX      .     .     .     .     YY      .     .     .     .
;
data popstate;
	set pf70 pm70 pf80 pm80;
	label pop= 'Census Population In Millions';
title 'The SAS System';
proc univariate data=popstate freq plot normal;
	var pop;
	id state;
	by decade sex;
	output out= univout mean= popnmean median= popn50
		pctlpre= pop_  pctlpts= 50, 95 to 100 by 2.5;
proc print data= univout;
	title 'Output Dataset From PROC UNIVARIATE';
	format popn50 pop_50 pop_95 pop_97_5 pop_100 best8.;
