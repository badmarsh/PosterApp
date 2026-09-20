# SurgiVLA: Safety-Constrained Vision-Language-Action Microsurgery

## Abstract
SurgiVLA couples a multimodal policy to a control-barrier safety shield, achieving 98.7% task success and 0.31 mm median endpoint error in 1,240 blinded ex-vivo trials.

## Methods
A 7B-parameter backbone fuses stereo endoscopy, force telemetry, language intent, and robot state. A 42 Hz action head proposes trajectories; conformal uncertainty triggers a certified safe-stop. Endpoints, exclusions, and stopping rules were preregistered.

## Results
Against OpenVLA, success improved from 86.2% to 98.7% (paired permutation p < 0.001, Holm corrected). Median latency was 23.8 ms. No critical safety violation occurred in the stress suite.

## Limitations
Ex-vivo results do not establish clinical efficacy. Rare-event confidence intervals remain wide and calibration must be monitored under deployment shift.
