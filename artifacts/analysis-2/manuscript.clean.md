# Analysis 2




<!-- Page 1 -->


### Chapter 1


## JES and JER from W - analysis


## overview

The use of hadronically decaying W boson for jet calibration was already proposed long
before Run 1 [1]. Although this technique has never been included in the nominal JES
calibration, it was used as a cross-check in the 7 TeV JES measurement, as described in
Section 15 in [2]. In addition, several ATLAS [3–5], CMS [6] or CDF (at Tevatron) [7]
top-quark mass measurements have exploited the precisely known W -boson mass to
constrain the JES uncertainties. While the corrections derived in the top-quark mass
measurements are not universal, they demonstrate the sensitivity of the reconstructed
W -boson mass to the jet calibration.
Single-lepton t t ¯ events, shown in Figure 1.1, are used for the presented measurements.
1
In these events, each top quark decays into a b -quark and a W boson. One of the
W bosons decays leptonically into a charged lepton and a neutrino, while the other
2
W boson decays hadronically into two light-quark jets. The two jets are used to
reconstruct the invariant mass of the W boson, which is very sensitive to the scale
and resolution of the jets. The single-lepton t t ¯ production has a large cross section
√
of 830 pb, with a relative uncertainty of 4 . 6% , at s = 13 TeV at the LHC [8]. It
features a distinctive experimental signature consisting, at LO, of two b -jets, one isolated
charged lepton that is used for triggering, missing transverse momentum arising from
the undetected neutrino, and two light-flavoured jets originating from the hadronic
decay of the W -boson. Additional jets can arise from final-state radiation or initial-state
1
Throughout this analysis, the terms top quark, b -jet, lepton and neutrino are used generically to
denote both particles and their antiparticles: top and anti-top quarks, b - and ¯ b -initiated jets, leptons
and antileptons, and neutrinos and antineutrinos, respectively.
2
In this analysis, the term light-quark jet is used to denote jets initiated by u , d , s , or c quarks (and
their corresponding antiquarks). While charm quarks are generally not classified as light quarks, they
are included in the light-quark jet definition adopted here, which simply excludes b -quarks.


<!-- Page 2 -->

radiation. This signature allows a clean event selection, with only a small contribution
from background processes (described in Section sec:background).
b
q / ν ℓ
q
t + ′ +
W q / ℓ
−
− ℓ / q
W
t
q
′
ν ℓ / q
b
Figure 1.1: Feynman diagram of t t ¯ production in proton-proton collisions, with top-quark
decay in the single-lepton decay channel.
Unlike in the standard ATLAS in situ calibration techniques described in Chapter ?? ,
there is no well-measured reference object to balance the jet system. Instead, a forward-
folding technique (Chapter 2) is used to produce the reconstructed W -boson mass
distributions under different JES or JER assumptions, referred to as the W -mass
templates (Chapter 5).
The object definitions specific to the presented measurement are introduced in
Chapter 3. These definitions establish the objects used throughout the analysis and
form the basis for the subsequent event selection introduced in Chapter 4. In the
selected events, the two jets originating from the hadronic W -boson decay are identified,
and the invariant mass of the W boson is reconstructed from these jets.
The mean of the W -boson mass distribution is used to determine the JES correction
from fit to data, while the standard deviation is used to determine the JER correction
(Chapter 6).
To allow for a future combination with other ATLAS in situ calibration methods,
the JES and JER correction factors are measured separately.
For the JES measurement, the best available in situ JER calibration is applied
to simulated samples, while no in situ JES calibration is applied to data, as the JES


<!-- Page 3 -->



correction is the quantity being measured. The in situ JER calibration consists of
smearing the p T of jets in simulation to reproduce the typically worse JER in data,
as described in Section ?? . However, the corresponding smearing has not yet been
derived for the current ATLAS reconstruction software release and it is therefore not
used. The difference in JER between data and simulation is currently accounted for in
the considered systematic uncertainties. Conversely, for the JER measurement, the best
available in situ JES calibration is applied to data, while no in situ JER calibration is
applied to simulation.
Once the in situ JER calibration has been derived for the current ATLAS recon-
struction software release, two versions of the simulated samples will be used. One will
include the in situ JER calibration and will be used for the JES measurement. The
other will not include the in situ JER calibration and will be used for the JER measure-
ment. Thus, the JES measurement will compare data without an in situ calibration to
simulation with the in situ JER calibration applied, whereas the JER measurement
will use data with the in situ JES calibration applied and simulation without the in
situ JER calibration
To account for the correlations between JES and JER, the JER systematic uncer-
tainties (see Chapter ?? ) are considered in the JES measurement and vice versa.


<!-- Page 5 -->


### Chapter 2


## Forward-folding method

Forward-folding method [9–11] is used to simulate the changes in the reconstructed jet p T
due to different assumptions of JES or JER. The forward-folding formula (Equation 2.1)
reco
is applied individually on the reconstructed p of jets, taking into account their true
T
truth
momenta p and taking an assumption on JES or JER. The invariant mass of the W
T
boson, which is very sensitive to JES and JER, is then reconstructed from the folded
jets, producing the W -boson mass templates corresponding to the different JES and
JER assumptions (Section 5).

### 2.1 Reco-to-truth matching

In order to perform the forward-folding, the reco jets (defined in Section ?? ) have to be
paired with corresponding truth jets. This pairing is based on angular distance ∆ R
between the reco jet and the truth jet. The closest truth jet, i.e. the truth jet with
lowest ∆ R within ∆ R = 0 . 2 , is matched to the reco jet. If there is no truth jet within
∆ R = 0 . 2 , the reco jet is left unmatched. In case the same truth jet is matched to
various reco jets in the event, these jets (both reco jet and truth jet) are considered
unmatched as well.
When multiple truth jets are located close to the truth jet matched to a reco jet,
reco 1
the physical origin of p cannot be uniquely assigned to a single truth jet . To avoid
T
this ambiguity and ensure reliable one-to-one jet matching, the truth jets considered in
the matching procedure are required to be well isolated and thus no other truth jet is
allowed within ∆ R = 0 . 5 of the truth jet that is being matched to the reco jet.
In addition, no prompt truth electron or muon are allowed within ∆ R = 0 . 5 of the
reco jet to avoid any prompt lepton being included in the jet reconstruction.
1 reco
In particular, p T may correspond to the p T of a single truth jet, to the combined p T of multiple
truth jets, or to only a fraction of the p T associated with one or more truth jets.


<!-- Page 6 -->

The forward-folding is not applied on jets that do not satisfy the matching and
isolation criteria described above, and they are treated as a background for JES or JER,
as they do not provide any separation between the different assumptions for JES and
JER.

### 2.2 Forward-folding formula

reco
The reconstructed transverse momenta p of the detector level jets are transformed
T
with the forward-folding formula, assuming various corrections to JES and JER used in
simulation, s and r , respectively:
folded reco reco truth
p T = s · p T + ( p T − R · p T ) · ( r − s ) , (2.1)
truth
where p is the momentum of truth jet matched to the reco jet (the matching
T
procedure is described in Section 2.1), R is the mode of the jet response distribution:
 
reco
p
T
R = argmax .
truth
p
T
The mode of the response distribution is used instead of the mean because it is
more stable against changes in the tail of the response distribution, which can cause
the mean to shift while leaving the peak (mode) of the distribution unchanged.
Equation 2.1 can be rewritten as:
folded truth reco truth
p T = s · R · p T + r · ( p T − R · p T ) , (2.2)
truth
where the term R · p is the reconstructed p T corresponding to the peak (mode) of
T
reco truth
the response distribution, while p − R · p is the event-by-event fluctuation around
T T
truth truth
this central value R · p . Shifting R · p by s corresponds to shifting the mode
T T
of the response distribution which defines the JES, while modifying the fluctuation
reco truth
around the central value p − R · p by r corresponds to modifying the width of
T T
the response distribution which defines the JER.
folded reco
The jet four-momentum is scaled by p /p , yielding the folded jet.
T T
The corrections s and r range from 0 . 95 to 1 . 05 and 0 . 60 to 1 . 40 , respectively.
When smearing jets with different JES ( s ) values, the JER ( r ) values are set to unity
and vice-versa to generate pure JES and pure JER variations. The values of R are
estimated by fitting a Gaussian function around the peak of the jet response (defined by


<!-- Page 7 -->



Equation ?? in Chapter ?? ) distribution in the nominal MC simulation, separately for
p T bins 0 − 20 GeV , 20 − 35 GeV , 35 − 50 GeV , 50 − 70 GeV , 70 − 100 GeV , 100 − 150 GeV ,
150 − 200 GeV and > 200 GeV , η bins | η | < 0 . 8 , | η | < 1 . 3 and | η | < 2 . 5 and for b -jets,
c -jets, gluon jets or light ( u, d, s )-jets (the truth flavour labels are available for jets in
simulation as explained in Section ?? ).
The Run 2 response distributions for | η | < 0 . 8 bin and the 50 − 70 GeV p T bin are
shown in Figure 2.1. The response distribution for the nominal t t ¯ sample is shown
with the red Gaussian function around the peak and compared to several other t t ¯
samples, separately for the different types of jets. The samples ending with "FS" are
the full-simulation samples and samples ending with "AF" are fast-simulation samples,
hence the different responses. Run 2 response distributions for all the considered p T and
| η | bins are shown in Appendix A. Only Run 2 distributions are shown as the Run 3
distributions are very similar.
The R values used in the forward-folding formula (Equation 2.1) are listed in
Tables 2.1 and 2.1 for Run 2 and Run 3, respectively. The b -jet response in the 0-
20 GeV p T bin is not relevant for this analysis as we require at least 30 GeV for the
b -jets. No uncertainties on the obtained response values are considered in the forward-
folding formula, however, several systematic uncertainties that impact jet response are
considered for the JES and JER measurement (see Chapter ?? ). Several trends can
be observed. The response for lower p T jets differs from unity, while it approaches
unity with increasing p T . The b -jet response is lower than one due to b -jets decaying
also semi-leptonically into a charged lepton and a neutrino, with the neutrino being
undetected. The gluon-jet response shows the best compatibility with unity across the
whole p T range due to the MC JES calibration (which aims to correct the response
to unity, see Section ?? ) being derived using dijet events, which are dominated by
gluon-initiated jets.


<!-- Page 8 -->

Table 2.1: The mean values of Run 2 simulated response R from nominal MC for different
p T bins and different jet flavours.
jet p T [GeV ] b -jets c -jets gluon jets light jets
0 - 20 0.97 1.21 1.20 1.24
20 - 35 1.08 1.03 1.01 1.07
35 - 50 0.97 1.00 0.98 1.03
50 - 70 0.98 1.01 0.99 1.03
70 - 100 0.98 1.01 0.99 1.02
100 - 150 1.00 1.01 0.99 1.01
150 - 200 1.00 1.00 0.99 1.01
> 200 0.99 1.00 0.99 1.00
Table 2.2: The mean values of Run 3 simulated response R from nominal MC for different
p T bins and different jet flavours.
jet p T [GeV] b -jets c -jets gluon jets light jets
0 - 20 1.11 1.18 1.18 1.23
20 - 35 1.08 1.04 1.02 1.07
35 - 50 0.97 1.01 0.99 1.04
50 - 70 0.98 1.01 0.99 1.03
70 - 100 0.98 1.01 0.99 1.02
100 - 150 1.00 1.01 0.99 1.01
150 - 200 0.99 1.00 0.99 1.00
> 200 0.99 1.00 0.99 1.00


<!-- Page 9 -->



0.12 s = 13 TeV, 140 fb -1 0.14 s = 13 TeV, 140 fb -1
t t PowhegPythia8 FS t t PowhegPythia8 FS
anti-k R = 0.4 (PFlow+JES) 0.12 anti-k R = 0.4 (PFlow+JES)
0.1 t t t PowhegPythia8 AF t t t PowhegPythia8 AF
t t PowhegHerwig FS 0.1 t t PowhegHerwig FS
0.08
Arbitrary units | η | < 0.8 Arbitrary units 0.08 | η | < 0.8
0.06 50 < p T < 70 [GeV] 50 < p T < 70 [GeV]
b-jet 0.06 c-jet
0.04
0.04
0.02 0.02
0.6 0.8 1 1.2 1.4 1.6 1.8 2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1.2 1.2
b-jet reco p /truth p [-] c-jet reco p /truth p [-]
1 T T 1 T T
0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
b-jet reco p /truth p [-] c-jet reco p /truth p [-]
T T T T
(a) (b)
0.14
0.14 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
anti-k R = 0.4 (PFlow+JES) anti-k R = 0.4 (PFlow+JES)
0.12 t t t PowhegPythia8 AF 0.12 t t t PowhegPythia8 AF
t t PowhegHerwig FS t t PowhegHerwig FS
0.1 0.1
| η | < 0.8 | η | < 0.8
Arbitrary units 0.08 Arbitrary units 0.08
50 < p < 70 [GeV] 50 < p < 70 [GeV]
T T
0.06 light jet 0.06 gluon jet
0.04 0.04
0.02 0.02
0.6 0.8 1 1.2 1.4 1.6 1.8 2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1.2 1.2
light jet reco p /truth p [-] gluon jet reco p /truth p [-]
1 T T 1 T T
0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
light jet reco p /truth p [-] gluon jet reco p /truth p [-]
T T T T
(c) (d)
Figure 2.1: The Run 2 simulated jet response distribution for jets with | η | < 0 . 8 and p T
from 50 − 70 GeV bin. The distributions are shown for the nominal t t ¯ sample produced with
Powheg+Pythia (black), the fast-simulation t t ¯ sample produced with Powheg+Pythia (yellow),
the fast-simulation t t ¯ sample produced with Powheg+Herwig (orange), the fast-simulation t t ¯
sample produced with Powheg+Pythia using the recoilToTop recoil model in Pythia (light
blue), and the fast-simulation t t ¯ sample produced with Powheg+Pythia with the Pythia
underlying-event variation Var1Down (dark blue). The response distributions are shown
separately for (A) b -jets, (B) c -jets, (C) light jets, and (D) gluon jets. The red line represents
the Gaussian fit to the response distribution of the nominal t t ¯ sample. The bottom panel
shows the ratios of jet response distributions in the alternative samples over the jet response
in the nominal t t ¯ Powheg+Pythia sample.


<!-- Page 11 -->


### Chapter 3


## Analysis-specific object definitions

The electrons in the presented measurement are defined using the tight identification
working point (defined in Section ?? ) and Tight_VarRad isolation working point (defined
in Section ?? ) and maximum transverse impact parameter significance w.r.t. the
beam line maxD0significance (defined in Section ?? ) less or equal to five. The
tracks associated to an electron must satisfy a requirement on the longitudinal impact
parameter (defined in Section ?? ) w.r.t. the primary vertex such that | z 0 sin θ | < 0 . 5
mm, where θ is the polar angle of the track (defined in Section ?? ). These electrons
are required to have p T > 27 GeV and | η | < 2.47 and not come from the crack region
between the barrel and end-cap calorimeters (1.37 < | η | < 1.52).
The muons are identified using the Medium identification working point (defined in
Section ?? ) and Tight_VarRad isolation working point (defined in Section ?? ) and max-
imum transverse impact parameter significance w.r.t the beam line maxD0significance
less or equal to three. The longitudinal impact parameter w.r.t the primary vertex is
required to satisfy | z 0 sin θ | < 0.5 mm. The muons are required to have p T > 27 GeV ,
| η | < 2.5.
The selected electron and muon working points ensure that the contribution from
fake leptons is sufficiently suppressed, while retaining high efficiency for prompt leptons.
The analysis would not benefit significantly from the additional statistics provided
by looser working points, whereas the increased contribution from fake-leptons would
reduce the selection purity. The electron and muon p T requirement is imposed in order
to have fully efficient single-electron and single-muon triggers (see Section ?? ).
miss
The Tight E working point is used.
T
The presented analysis uses two event selections, the low- p T selection is applied to
the MC simulated events, and the high- p T selection, applied to data. The two event
selections use their corresponding object definitions: the low- p T and the high- p T objects.


<!-- Page 12 -->

The primary difference between the two object definitions is the minimum p T
requirement for jets. In the high- p T objects, jets are required to satisfy p T > 20 GeV ,
while in the low- p T objects, jets satisfy p T > 15 GeV . This lower threshold is chosen
because the forward-folding procedure (described in Section 2), applied only on the
simulated events, modifies the jet p T . Jets with 15 GeV < p T < 20 GeV are kept, as
they may be shifted above the 20 GeV threshold after the forward-folding procedure.
The differences in the remaining reconstructed objects between the high- p T and low- p T
definitions arise only from the overlap removal procedure (described in Section ?? ). The
overlap removal between the low p T jets and electrons and muons, as well as between
the high p T jets and electrons and muons is performed separately, resulting in two sets
of jets, electrons and muons, corresponding to the low p T and high p T definitions, which
are used in this analysis.
The detector-level jets, referred to as the reco jets (defined in Section ?? ), correspond
to the PFlow jets reconstructed by clustering particle flow objects (see Section ?? ) with
the anti- k T algorithm using a R=0.4 radius parameter (see Section ?? ), implemented
in the FastJet software package (see Section ?? ). To suppress jets originating from
pile-up, jets with p T < 60 GeV are required to satisfy a neural-network-based jet vertex
tagger (NNJVT) discriminant (see Section ?? ). The default NNJVT working point
FixedEffPt is used. In simulated samples, jets with p T > 15 GeV and | η | < 2 . 5 are
preselected. In subsequent analysis stages, following the forward-folding procedure
where applicable, jets are required to satisfy p T > 20 GeV , while b -jets must satisfy
p T > 30 GeV . The 20 GeV threshold is chosen because it is the minimum p T for
which jet calibration is available in ATLAS. The lower preselection threshold of 15 GeV
ensures the inclusion of jets that cross the p T > 20 GeV requirement only after the
forward-folding. The 30 GeV requirement for b-jets prevents them from falling, after
forward-folding, below 20 GeV threshold required for b -tagging. The b -jets with p T <
20 GeV cannot be b -tagged and would therefore be excluded from the analysis. Because
b -jets have typically higher p T , this requirement does not result in a significant loss of
events. The two jets that are used for the reconstruction of the invariant mass of W
boson are required to have | η | < 0 . 8 since only central jets are used for absolute in
situ jet calibration in ATLAS, while the relative η -intercalibration corrects the forward
jets ( | η | < 4 . 5 ) to the scale of the calibrated central jets, as explained in Section ?? .
The b -jets are identified by the GN2v01 flavour tagging algorithm (described in
Section ?? ) with a working point corresponding to an efficiency of 85% in a t t ¯ reference
sample.


<!-- Page 13 -->



3.0.1 Particle-level object definitions
Particle-level leptons, referred to as the truth leptons, are selected as leptons originating
from the decay of a W or Z boson. The four-momentum of an electron or muon is
summed with the four-momenta of all radiated photons within a cone of size ∆ R = 0.1
around its direction, excluding photons from hadron decays.
The particle-level jets, referred to as the truth jets, are reconstructed with the
anti- k T algorithm with a radius parameter of R = 0.4, using all stable particles (with
τ ≥ 30 ps) except for the electrons, muons, and photons used in the definition of leptons
and neutrinos originating from the W or Z bosons. The truth jets are required to have
p T > 10 GeV and | η | < 2 . 5 .


<!-- Page 15 -->


### Chapter 4


## Event selection and hadronic W -boson


## reconstruction

Motivated by the signature of t t ¯ decays in the single-lepton channel, selected events are
required to contain at least four jets, of which at least two must be b -jets, exactly one
miss
electron or muon, and one neutrino, which contributes to E .
T
Two event selections are used to define the preselection for this analysis. The high- p T
event selection is applied to the recorded data, while the low- p T event selection is applied
to the MC simulated events. Each selection uses the corresponding object definitions.
Specifically, the high- p T event selection requires events to contain at least four high- p T
jets with p T > 20 GeV , two of those must be b -tagged, and one high- p T lepton, whereas
the low- p T event selection requires at least four low- p T jets with p T > 15 GeV , two
of them must be b -tagged, and one low- p T lepton (see Chapter 3 for the high- p T and
miss
low- p T object definition). No E requirement is imposed at this stage.
T
Following the preselection described above, an additional set of event selection
criteria is applied to both the data and to the simulated events. For the simulation,
these criteria are applied after the forward-folding procedure, where applicable. At this
point, all events are required to contain at least four jets with p T > 20 GeV , of which
miss
at least two must be b -tagged and satisfy p T > 30 GeV and E is required to exceed
T
30 GeV . Finally, there have to be two jets identified as coming from the hadronic decay
2
of the W boson with a matching quality of χ < 1 . The identification of the jets from
miss
hadronic W -boson decay is described in the following Section 4.1. The 30 GeV E
T
requirement is imposed in order to suppress the fake-lepton contribution, as the real
prompt leptons from W -boson decay are accompanied by a neutrino which translates
miss
to large E .
T
The selection criteria described above define the Inclusive event selection. It is
used to produce the control plots comparing recorded data with the prediction and to


<!-- Page 16 -->

determine the jet response in MC simulation (defined in Section 2 by Equation 2.2).
Figures 4.1 and 4.2 show the control plots for basic kinematic distributions in the
Inclusive region for Run 2 data without the in situ correction applied. The remaining
Run 2 control plots showing the data without the in situ correction applied, as well as
the Run 3 versions of these plots are provided in Appendices B and C, respectively.
The uncertainty band represents all the considered uncertainties listed in Section ?? .
2
By imposing the χ < 1 requirement (see Equation 4.1 in the following section) to select
events where two light jets can be reliably identified as originating from a hadronic W -
boson decay, background processes are further suppressed. Consequently, only 5% of the
selected simulated events in the Inclusive region originate from background processes,
with the dominant contribution coming from single-top quark production (specifically
tW associated production; see Section ?? for a detailed description of the considered
backgrounds). Figure 4.3 illustrates the event yields for the signal t t ¯ process and the
considered backgrounds both before and after the application of this cut, showing how
2
the χ < 1 requirement reduces the background contamination. A reasonable agreement
between the predicted distributions and observed data is seen with some known features
such as mismodelling in the lepton p T spectrum that is likely related to missing higher
order calculations in the MC generators [12].


<!-- Page 17 -->



3
10 9 × 10
Data 160 Data
10 8 s = 13 TeV, 140 fb -1 t t s = 13 TeV, 140 fb -1 t t
SingleTop 140 SingleTop
10 7 anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets 120 Z+jets
10 6 Diboson Diboson
Fake leptons 100 Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 0.20 Uncertainty
10 4 80
10 3 60
10 2 40
10 20
0 100 200 300 − 2 0 2
1.2 1.2
1 p [GeV] 1 eta
T
0.8 0.8
0 100 200 300 − 2 0 2
Data/Pred. Data/Pred.
Electron p [GeV] Electron η [-]
T
(a) (b)
3
10 9 140 × 10
-1 Data -1 Data
10 8 s = 13 TeV, 140 fb t t s = 13 TeV, 140 fb t t
SingleTop 120 SingleTop
10 7 anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets 100 Z+jets
10 6 Diboson Diboson
Fake leptons Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 0.20 80 Uncertainty
10 4
60
10 3
40
10 2
20
10
0 100 200 300 − 2 0 2
1.2 1.2
1 p [GeV] 1 eta
T
0.8 0.8
0 100 200 300 − 2 0 2
Data/Pred. Data/Pred.
Muon p [GeV] Muon η [-]
T
(c) (d)
Figure 4.1: The Run 2 distributions of the reconstructed leptons in data (without JES in
situ correction) and MC in the Inclusive region with no p T or η cut on the jets from W boson.
(A) Electron p T in logarithmic scale, (B) electron η , (C) muon p T in logarithmic scale and
(D) muon η . The uncertainty represents all considered systematic uncertainties as described in
Section ?? . The bottom panels show the ratio of the data to the MC prediction.


<!-- Page 18 -->

3
10 9 300 × 10
-1 Data -1 Data
10 8 s = 13 TeV, 140 fb t t s = 13 TeV, 140 fb t t
SingleTop 250 SingleTop
10 7 anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets Z+jets
10 6 Diboson 200 Diboson
Fake leptons Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 0.20 Uncertainty
150
10 4
10 3 100
10 2
50
10
0 100 200 300 − 2 − 1 0 1 2
1.2 1.2
1 p [GeV] 1 eta
T
0.8 0.8
0 100 200 300 − 2 − 1 0 1 2
Data/Pred. Data/Pred.
Leading jet p [GeV] Leading jet η [-]
T
(a) (b)
3
× 10
10 9
-1 Data -1 Data
10 8 s = 13 TeV, 140 fb t t s = 13 TeV, 140 fb t t
SingleTop 250 SingleTop
anti-k R = 0.4 (PFlow+JES) anti-k R = 0.4 (PFlow+JES)
10 7 t W+jets t W+jets
Z+jets Z+jets
10 6 Diboson 200 Diboson
Fake leptons Fake leptons
Events / 0.20
Events / 5 GeV 10 5 Uncertainty Uncertainty
150
10 4
10 3 100
10 2
50
10
0 50 100 150 200 250 − 2 − 1 0 1 2
1.2 1.2
1 p [GeV] 1 eta
T
0.8 0.8
0 50 100 150 200 250 − 2 − 1 0 1 2
Data/Pred. Data/Pred.
Second jet p [GeV] Second jet η [-]
T
(c) (d)
Figure 4.2: The Run 2 distributions of the reconstructed jets in data (without JES in situ
correction) and MC in the Inclusive region with no p T or η cut on the jets from W boson.
(A) p T of the leading jet in logarithmic scale, (B) η of the leading jet, (C) p T of the second
leading jet in logarithmic scale and (D) η of the second leading jet. The uncertainty represents
all considered systematic uncertainties as described in Section ?? . The bottom panels show
the ratio of the data to the MCprediction.


<!-- Page 19 -->



no χ² cut
(a)
χ² < 1
(b)
Figure 4.3


<!-- Page 20 -->


### 4.1 Hadronic W -boson kinematics reconstruction

At LO, the topology of the single-lepton t t ¯ decay consists of four jets, two of which
are b -jets. Due to QCD gluon radiation and gluon splitting, additional jets may be
present in the production or decay at higher orders, which are predominantly gluon or
light-flavour jets. To reconstruct the invariant mass of the hadronically decaying W
boson, the two jets from its decay need to be identified, that is, the reconstructed jets
need to be matched to the W -boson decay products.
There is no unique algorithm for this matching and several algorithms have been
2
developed, such as those introduced in [13] or [14]. In this analysis, a simple χ algorithm
is used for the matching. The algorithm takes advantage of the known masses of the W
boson and the top quark. It considers possible permutations of up to six highest p T
reconstructed jets and selects the one that gives the best agreement with the expected
2
W -boson and top-quark masses. The level of agreement is quantified by the χ value,
defined as
reco fixed 2 reco fixed 2
( m − m ) ( m − m )
2 t t W W
χ = + , (4.1)
2 2
Σ t Σ
W
reco
where m t is the invariant mass of the reconstructed three-jet system from the
fixed
top-quark decay, m t is the fixed top-quark mass set to 172.5 GeV and the constant
in the denominator Σ t accounts for the decay width of the top quark, as well as for its
reco
approximate experimental resolution and its value is set to 35 GeV . Similarly, m is
W
fixed
the invariant mass of the reconstructed two-jet system from the W -boson decay, m
W
is the fixed W -boson mass set to 80.38 GeV , and Σ W accounts for the W -boson decay
width and its approximate experimental resolution and its value is set to 25 GeV . It
was tested that changing the Σ t and Σ W values to 15 GeV and 10 GeV , respectively and
2
changing the χ requirement to preserve the selection efficiency, does not significantly
impact the reconstruction performance. If there are more than six jets in an event,
at least two b -tagged jets (ordered in p T ) are always considered and then up to four
other jets (ordered in p T ) are considered. Only the permutations where the b -tagged
jets are in the position of a true b -jet (i.e. not in the position if the light jets from the
W decay) are considered. Permutations that lead to invariant changes, e.g. if only
the two light jets from the W are swapped, are skipped to save computing time. The
2
permutation with the lowest χ value is considered to be the correct one. In order to
2
improve the matching efficiency, only events satisfying χ < 1 for the best permutation


<!-- Page 21 -->



are considered further in the analysis. This requirement removes approximately half of
the events satisfying all the other selection criteria.
Figure 4.4 shows the comparison of W -boson mass distribution between data and
prediction in Run 2 and Run 3 in the Inclusive region, for data with and without the
in situ correction applied.
3 3
× 10 × 10
200 s = 13 TeV, 140 fb -1 Data t t 200 s = 13 TeV, 140 fb -1 Data t t
180 anti-k R = 0.4 (PFlow+JES) SingleTop 180 anti-k R = 0.4 (PFlow+JES in situ ) SingleTop
t W+jets t W+jets
160 Z+jets 160 Z+jets
Diboson Diboson
140 Fake leptons 140 Fake leptons
Events / 2 GeV 120 Uncertainty Events / 2 GeV 120 Uncertainty
100 100
80 80
60 60
40 40
20 20
60 80 100 60 80 100
1.2 1.2
1 W mass [GeV] 1 W mass [GeV]
0.8 0.8
60 80 100 60 80 100
Data/Pred. Data/Pred.
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b)
80000 80000
-1 Data -1 Data
s = 13.6 TeV, 52 fb t t s = 13.6 TeV, 52 fb t t
70000 SingleTop 70000 SingleTop
anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES in situ ) W+jets
60000 Z+jets 60000 Z+jets
Diboson Diboson
50000 Fake leptons 50000 Fake leptons
Events / 2 GeV Uncertainty Events / 2 GeV Uncertainty
40000 40000
30000 30000
20000 20000
10000 10000
60 80 100 60 80 100
1.2 1.2
1 W mass [GeV] 1 W mass [GeV]
0.8 0.8
60 80 100 60 80 100
Data/Pred. Data/Pred.
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(c) (d)
Figure 4.4: The Run 2 (top) and Run 3 (bottom) distributions of reconstructed W -boson
mass in data and MC in the Inclusive region with no p T or η cut on the jets from W boson,
without (left) and with (right) the JES in situ calibration applied to data. The uncertainty
represents all considered systematic uncertainties as described in Section ?? . The bottom
panels show the ratio of the data to the MC prediction.
The W -boson mass peak does not match well between the prediction and data
without the in situ corrections, suggesting that JES needs to be corrected to match
data well. However, the W -boson mass peak distribution is reasonably well covered


<!-- Page 22 -->

by the provided uncertainty band due to a large uncertainty originating from the t t ¯
modelling (mainly Pythia versus Herwig comparison).

### 4.2 Analysis regions

The JES and JER in situ corrections are provided as a function of jet p T , and only jets
with | η | < 0 . 8 are used for in situ jet calibration in ATLAS. Building on the Inclusive
selection, the analysis is further divided into analysis regions defined by the p T and | η |
of the two jets from the hadronic W -boson decay. Six p T bins are considered in this
measurement: 20 − 35 GeV , 35 − 50 GeV , 50 − 70 GeV , 70 − 100 GeV , 100 − 150 GeV ,
and 150 − 200 GeV . The discrete correction factors obtained for each p T bin will be
used to derive a continuous correction function via interpolation. The region-specific
jet p T and | η | criteria are applied on top of all the selection criteria described up to
this point. Table 4.1 summarises the different selection criteria applied in the analysis.
Table 4.1: Summary of event selection criteria applied in different stages of the analysis for
data and MC simulation. Preselection criteria are applied before forward-folding, while the
Inclusive and Analysis region selection criteria are applied to simulated events after forward-
folding.
Analysis stage Data MC simulation
≥ 4 jets ( p T > 20 GeV) ≥ 4 jets ( p T > 15 GeV)
≥ 2 b -tagged jets ≥ 2 b -tagged jets
Preselection
= 1 lepton ( p T > 27 GeV) = 1 lepton ( p T > 27 GeV)
miss miss
no E T requirement no E T requirement
≥ 4 jets ( p T > 20 GeV)
≥ 2 b -tagged jets ( p T > 30 GeV)
Inclusive region = 1 lepton ( p T > 27 GeV)
miss
E T > 30 GeV
2
2 jets from hadronic W -boson decay ( χ < 1 )
Categorization based on p T and | η |
Analysis regions
of the two jets from hadronic W -boson decay
Two groups of analysis regions are used, the diagonal regions, where both jets from
W -boson decay have | η | < 0 . 8 and fall into the same p T bin, and the off-diagonal
regions, where both jets from W -boson decay have | η | < 0 . 8 but belong to different
p T bins. Figure 4.5 illustrates the definition of the analysis regions, along with the
number of selected events in Run 2 data without the in situ correction in each region.
The diagonal-region where both jets have p T between 20 and 35 GeV is excluded from


<!-- Page 23 -->



the measurement, as there are virtually no jets from the W -boson decay due to the
kinematic restriction of the p T and the jet | η | requirements.

### ATLAS

-1
[GeV] 150-200 s = 13 TeV, 140 fb
634
reco T anti-k t R = 0.4 (PFlow+JES)
| η | < 0.8
jet
100-150
6138 3975
Sub-leading jet p 70-100
12321 16678 5733
50-70 19518 29587 18366 5739
35-50 34206 53508 35191 19908 5590
20-35 55448 83730 70347 34007 7975
20-35 35-50 50-70 70-100 100-150 150-200
reco
Leading jet p [GeV]
T
Figure 4.5: Definition of the analysis regions based on reconstructed p T and | η | of the two
jets identified to originate from the W -boson decay. The two jets from W boson are required
to have | η | < 0.8. The regions shown on the diagonal are the regions where both jets from
the W boson belong to the same reconstructed p T bin, off-diagonal are the regions where
the two jets belong to different reconstructed p T bins. The diagonal region with both jets
having reconstructed p T between 20 and 35 GeV is not used due to kinematic restrictions.
The numbers in the bins represent the number of selected events in Run 2 data without the in
situ correction. [15]
The Run 2 and Run 3 comparisons of W -boson mass distribution between data and
prediction for all the analysis regions are provided in Appendix ?? , for both versions of
data, with and without the in situ correction applied. In general, a better agreement
between data and prediction is seen for the Run 3 distributions of the W -boson mass,
suggesting that JES is better modelled in the Run 3 simulation, possibly due to the
improvements in the GEANT4 simulation between Run 2 and Run 3 mentioned in [16].

### 4.3 W -boson reconstruction efficiency

A jet is considered matchable if there is a parton from W -boson decay within ∆ R < 0 . 4
of the reconstructed jet, that can be uniquely assigned. Only unique matches are


<!-- Page 24 -->

considered, i.e. if one parton falls within ∆ R < 0 . 4 of multiple reconstructed jets, these
reconstructed jets are labeled as not matchable . If both jets from the W -boson decay
can be matched to the partons, the event is considered matchable. The efficiency of the
W -boson reconstruction, also referred to as the matching efficiency , is defined as the
fraction of correctly matched events relative to either all events passing a given event
selection or all matchable events.
Tables 4.2-4.7 show the matching efficiency in the nominal Powheg+Pythia t t ¯
sample. The tables show the efficiency in the different diagonal analysis regions relative
2
to the efficiency without the χ < 1 requirement, assuming the nominal JES and JER,
for both the Run 2 and Run 3 measurements. The MC statistical uncertainties, arising
from the limited number of the simulated events, are not displayed as they are negligible.
2
The χ < 1 requirement significantly increases the fraction of events in which both
jets from the hadronic W -boson decay were identified in a matchable event. This fraction
increases with jet p T , reaching ≈ 100 % in the 100 − 150 GeV and 150 − 200 GeV
diagonal regions. However, simulation studies reveal the presence of not matchable
events, where the unique assignment between both partons and reconstructed jets is
fundamentally impossible. The fraction of such events relative to the selected events
decreases with higher jet p T , dropping to ≈ 1% in the 150 − 200 GeV diagonal region.
The matching efficiencies are very consistent between Run 2 and Run 3. The matching
procedure from Section 4.1 is repeated for each JES and JER assumption because the
change in jet p T can result in different pair of jets being identified as originating from
W -boson decay.


<!-- Page 25 -->



Table 4.2: Matching efficiency in the 20 - 35 GeV diagonal analysis region for events with
2 2
χ < 1 and for events with no additional χ requirement, in the Run 2 and Run 3 simulated
t t ¯ events. Fraction of matchable events relative to all events passing the selection is shown
as well as the fraction of events with correctly matched jet(s) relative to matchable events or
relative to all events passing the selection.
20 - 35 GeV
20 - 35 GeV Run 2 Run 3
2 2 2 2
Category χ < 1 No χ cut χ < 1 No χ cut
Both jets matchable relative to all 49% 27% 49% 28%
Jet 1 matched and Jet 2 failed relative to matchable 21% 31% 21% 31%
Jet 1 failed and Jet 2 matched relative to matchable 9% 14% 10% 15%
Both jets matched relative to matchable 56% 40% 54% 38%
Jet 1 matched and Jet 2 failed relative to all 10% 8% 10% 9%
Jet 1 failed and Jet 2 matched relative to all 5% 4% 5% 4%
Both jets matched relative to all 28% 11% 27% 10%
Table 4.3: Matching efficiency in the 35 - 50 GeV diagonal analysis region for events with
2 2
χ < 1 and for events with no additional χ requirement, in the Run 2 and Run 3 simulated
t t ¯ events. Fraction of matchable events relative to all events passing the selection is shown
as well as the fraction of events with correctly matched jet(s) relative to matchable events or
relative to all events passing the selection.
35 - 50 GeV
Run 2 Run 3
2 2 2 2
Category χ < 1 No χ cut χ < 1 No χ cut
Both jets matchable relative to all 74% 66% 74% 66%
Jet 1 matched and Jet 2 failed relative to matchable 13% 15% 13% 15%
Jet 1 failed and Jet 2 matched relative to matchable 6% 7% 7% 8%
Both jets matched relative to matchable 72% 69% 72% 69%
Jet 1 matched and Jet 2 failed relative to all 10% 10% 10% 10%
Jet 1 failed and Jet 2 matched relative to all 5% 5% 5% 5%
Both jets matched relative to all 54% 46% 53% 45%


<!-- Page 26 -->

Table 4.4: Matching efficiency in the 50 - 70 GeV diagonal analysis region for events with
2 2
χ < 1 and for events with no additional χ requirement, in the Run 2 and Run 3 simulated
t t ¯ events. Fraction of matchable events relative to all events passing the selection is shown
as well as the fraction of events with correctly matched jet(s) relative to matchable events or
relative to all events passing the selection.
50 - 70 GeV
Run 2 Run 3
2 2 2 2
Category χ < 1 No χ cut χ < 1 No χ cut
Both jets matchable relative to all 84% 72% 84% 71%
Jet 1 matched and Jet 2 failed relative to matchable 7% 11% 8% 11%
Jet 1 failed and Jet 2 matched relative to matchable 4% 6% 4% 6%
Both jets matched relative to matchable 84% 75% 83% 75%
Jet 1 matched and Jet 2 failed relative to all 6% 8% 6% 8%
Jet 1 failed and Jet 2 matched relative to all 3% 4% 3% 4%
Both jets matched relative to all 70% 54% 70% 53%
Table 4.5: Matching efficiency in the 70 - 100 GeV diagonal analysis region for events with
2 2
χ < 1 and for events with no additional χ requirement, in the Run 2 and Run 3 simulated
t t ¯ events. Fraction of matchable events relative to all events passing the selection is shown
as well as the fraction of events with correctly matched jet(s) relative to matchable events or
relative to all events passing the selection.
70 - 100 GeV
Run 2 Run 3
2 2 2 2
Category χ < 1 No χ cut χ < 1 No χ cut
Both jets matchable relative to all 91% 76% 91% 76%
Jet 1 matched and Jet 2 failed relative to matchable 3% 7% 3% 8%
Jet 1 failed and Jet 2 matched relative to matchable 2% 4% 2% 5%
Both jets matched relative to matchable 92% 82% 92% 81%
Jet 1 matched and Jet 2 failed relative to all 3% 6% 3% 6%
Jet 1 failed and Jet 2 matched relative to all 2% 3% 2% 4%
Both jets matched relative to all 84% 62% 84% 62%


<!-- Page 27 -->



Table 4.6: Matching efficiency in the 100 - 150 GeV diagonal analysis region for events with
2 2
χ < 1 and for events with no additional χ requirement, in the Run 2 and Run 3 simulated
t t ¯ events. Fraction of matchable events relative to all events passing the selection is shown
as well as the fraction of events with correctly matched jet(s) relative to matchable events or
relative to all events passing the selection.
100 - 150 GeV
Run 2 Run 3
2 2 2 2
Category χ < 1 No χ cut χ < 1 No χ cut
Both jets matchable relative to all 96% 80% 96% 79%
Jet 1 matched and Jet 2 failed relative to matchable 1% 5% 1% 5%
Jet 1 failed and Jet 2 matched relative to matchable 1% 3% 1% 4%
Both jets matched relative to matchable 96% 86% 96% 84%
Jet 1 matched and Jet 2 failed relative to all 1% 4% 1% 4%
Jet 1 failed and Jet 2 matched relative to all 1% 3% 1% 3%
Both jets matched relative to all 92% 68% 92% 66%
Table 4.7: Matching efficiency in the 150 - 200 GeV diagonal analysis region for events with
2 2
χ < 1 and for events with no additional χ requirement, in the Run 2 and Run 3 simulated
t t ¯ events. Fraction of matchable events relative to all events passing the selection is shown
as well as the fraction of events with correctly matched jet(s) relative to matchable events or
relative to all events passing the selection.
150 - 200 GeV
Run 2 Run 3
2 2 2 2
Category χ < 1 No χ cut χ < 1 No χ cut
Both jets matchable relative to all 99% 77% 98% 76%
Jet 1 matched and Jet 2 failed relative to matchable 1% 4% 1% 5%
Jet 1 failed and Jet 2 matched relative to matchable 0% 3% 1% 4%
Both jets matched relative to matchable 98% 84% 98% 84%
Jet 1 matched and Jet 2 failed relative to all 1% 3% 1% 3%
Jet 1 failed and Jet 2 matched relative to all 0% 3% 1% 3%
Both jets matched relative to all 97% 65% 96% 64%


<!-- Page 28 -->


### 4.4 Re-evaluating the event selection

Changes in the reconstructed jet p T can also affect whether an event passes or fails
the event selection criteria. When constructing the W -mass distributions for different
assumptions of the JES or JER, it is necessary to evaluate whether each event satisfies
the event selection criteria under the corresponding JES or JER assumption. Therefore,
a folded version of each event is produced for every JES ( s ) or JER ( r ) assumption. In
each variation, all jets satisfying the requirements described in Section 2.1 are folded
using the same JES or JER assumption, and the event selection criteria are re-evaluated
using the resulting folded event.
The matching algorithm described in Chapter 4.1 is run for every folded version of
event, generating a set of jet indices, identifying the jets from W boson as well as the
b -jet, for every s and every r correction assumption.
For the off-diagonal regions, two different JES values ( s 1 for the leading jet from the
W -boson decay and s 2 for the sub-leading jet) or JER values ( r 1 and r 2 , respectively)
are associated with each event. In this case, the event selection is re-evaluated using
the event folded with s = s 2 or r = r 2 , corresponding to the JES or JER assumption
for the sub-leading jet from W -boson decay.
The motivation for this choice is that the jet and b -jet multiplicities can change after
folding when the p T of a jet is close to the 20 GeV or 30 GeV selection thresholds, i.e.
the multiplicities are affected by the lower p T jet. This is an approximation, however
it is safe to make this approximation since the JES and JER corrections, s and r ,
respectively, are not expected to be very different for different p T bins.
miss
Similarly, E is evaluated for the event folded with either s 2 or r 2 , even though
T
miss
E depends on all jets in the event, which may have different p T values. While
T
miss
variations in E can affect the event acceptance, their impact on the reconstructed
T
W -boson mass distribution is expected to be negligible. This is supported by the
miss
negligible size of the E systematic uncertainties observed in the measurement (see
T
Section ?? ). It is therefore also considered safe to make this approximation.
miss
The impact of the folding on E is estimated approximately by propagating the
T
difference between the folded and original jet four-momenta using the following equation
X   
miss, folded miss, original jet folded,i jet original,i
p ⃗ T = p ⃗ T − p ⃗ T − p ⃗ T , (4.2)
i


<!-- Page 29 -->



miss jet
where p ⃗ T is the missing transverse momentum vector and p ⃗ T is the transverse-
momentum vector of jet i .


<!-- Page 31 -->


### Chapter 5


## W -boson mass templates

Once an event is confirmed to satisfy the selection criteria for a given JES ( s ) or
JER ( r ) assumption, the W -boson mass is reconstructed from the two jets identified as
originating from the W -boson decay under that assumption.
In the off-diagonal regions, where one scale or resolution ( s 1 or r 1 ) is assumed for
the leading jet from W and another one ( s 2 or r 2 ) for the sub-leading jet, the event
selection criteria are checked for the s 2 or r 2 assumption, as described in Section 4.4.
Another approximation is made, when the set of indices identifying the two jets from
W and the b -jet (there is a set of indices for each considered s and r value) for s = s 1
or r = r 1 does not match the indices for s = s 2 or r = r 2 , in which case the indices
corresponding to s = s 2 or r = r 2 are taken.
It is then checked whether the two jets from W -boson decay are well isolated by
imposing a cut on the jet isolation variable f iso < 0.3, which rejects jets with large
1
energy fraction outside of the jet radius R = 0 . 4 .
The f iso variable was introduced as the recommended jet isolation criterion for
defining jets used in the calibration. It is defined as follows:
iso
p − ρA iso
T
f iso = , (5.1)
Jet
p − ρA Jet
T
iso
where p is the p T of all constituents within an isolation annulus (green area in
T
Figure 5.1) with radius R iso = 1 . 25 R around the jet (grey area in Figure 5.1) with
Jet
radius R = 0 . 4 and p is the p T of all jet constituents. The pile-up contribution is
T
iso Jet
subtracted from both, p and p . It is obtained by multiplying the jet active area
T T
1
Energy outside the jet radius R = 0 . 4 can arise from radiation associated with the jet that was not
clustered into it, or from additional nearby activity that can affect the reconstructed jet energy. In order
to reconstruct the W -boson mass reliably, the two jets from its decay should be a good representation
of the corresponding decay products. The f iso requirement therefore rejects configurations which
introduce possible biases in the reconstructed jet energies and, consequently, in the reconstructed
W -boson mass


<!-- Page 32 -->

2
A Jet or the area of the isolation annulus A iso = πR iso − A Jet by the pile-up density ρ .
The recommended requirement is f iso ≤ 0 . 3 .
Figure 5.1: The definition of isolation annulus (green) with radius R iso around the jet (grey)
with radius R = 0 . 4 .
The invariant mass of W boson m W for the template distributions is calculated from
folded
folded four-momenta of the two jets identified to originate from W -boson, p ⃗ 1 and
folded
p ⃗ 2 , as:
q
folded folded 2 folded folded 2
m W = ( E 1 + E 2 ) − | p ⃗ 1 + p ⃗ 2 | . (5.2)
In diagonal regions, the leading and sub-leading jet from W -boson decay are folded
with the same s or r value, as they belong to the same p T bin. In off-diagonal region,
the leading jet is folded with s 1 or r 1 and the sub-leading jet with s 2 or r 2 .
2
Before calculating the W -boson mass, the χ < 1 criterion is checked again, using
2
the folded jets to calculate the χ value defined by Formula 4.1. The b -jet entering
2
the χ calculation is either folded with the same s or r as one of the light jets from
W -boson decay if it belongs to the same p T bin or is left unchanged.
Finally the events are split into the analysis regions by imposing the p T and η
requirements corresponding to the analysis regions (defined in Section ?? ) on the folded
four-momenta of the two jets from W , and the invariant mass of W boson for the
assumed JES or JER is calculated using Equation 5.2.
The templates are created from MC simulated t t ¯ sample as well as all considered
background samples and the contribution from fake leptons in added to each template.
In the diagonal regions, 11 templates with different values of s , ranging from 0.95 to
1.05, and 11 templates with different values of r , ranging from 0.60 to 1.4, are produced.


<!-- Page 33 -->



In the off-diagonal regions, 121 templates are produced for the JES variations,
corresponding to all combinations of 11 values of s 1 and 11 values of s 2 . Similarly, 121
templates are produced for the JER variations, corresponding to all combinations of 11
values of r 1 and 11 values of r 2 . The ranges of the considered values remain the same
as for s and r , that is 0.95–1.05 for the scale variations and 0.6–1.4 for the resolution
variations.
Tables 5.1 and 5.2 show the relative fractions of jets identified as originating from the
hadronic W -boson decay that fail to satisfy the requirements (described in Section 2.1)
needed to apply the forward-folding procedure in the Run 2 and Run 3 measurements,
respectively.
The fraction of reco jets failing the no truth lepton within ∆ R = 0 . 5 requirement
decreases with growing p T , same for the unmatched reco jet category but here the
fraction also increases for the last 150 − 200 GeV region. The fraction of jets failing
the truth jet isolation criterion is very similar in the first three regions with jet p T
from 20 to 100 GeV , then it grows with growing p T and it is at 75 % for the last
p T bin 150 − 200 GeV , which is reflected in the increased statistical uncertainty (see
Section 6.2) for said region, especially for JER since the resolution is better for higher
p T and thus changing the r value has only a small effect. For JES, even though the
separation between different s (JES) assumptions is bad due to low statistical power
when only 25 % of jets in the last p T bin are shifted by the forward-folding formula, it
is compensated by the fact that the s variation has a bigger effect for high p T .


<!-- Page 34 -->

Table 5.1:
Passed all criteria Failed Failed to match Failed Category jet
p
T
[GeV]
truth truth some of the required criteria, shown for the different diagonal regions in Run 2 measurement.
Fractions of jets identified to be from the
jet isolation lepton in jet
truth
jet
Inclusive
92.3 4.4 2.0 1.4
20
89.9
3.7 3.4 3.0 −
35
35 W
94.6
3.5 0.7 1.2 − boson decay that cannot be forward-folded due to failing
50
50
95.6
3.5 0.3 0.5 −
[%] 70
70
95.2 4.4 0.2 0.2 −
100
100
92.3
7.5 0.2 0.1 −
150
150
23.7 74.9
1.3 0.0 −
200


<!-- Page 35 -->



200
− 0.0 1.4
74.7 23.9
150
150
− 0.1 0.2 7.2
92.5
100
100
− 0.2 0.2 4.6 95.1
70
70 [%]
− 0.5 0.3 3.5
95.6
50
50
boson decay that cannot be forward-folded due to failing − 1.2 0.6 3.6
94.6
W 35
35
− 2.9 2.8 3.9
90.5
20
1.4 1.6 4.4 92.6
Inclusive
jet
truth
lepton in jet jet isolation
Fractions of jets identified to be from the
some of the required criteria, shown for the different diagonal regions in Run 3 measurement. truth truth
[GeV ]
T
p
jet Category Failed Failed to match Failed Passed all criteria
Table 5.2:


<!-- Page 36 -->

Figures 5.2-5.4 shows the effect of JES and JER variations in one representative
diagonal and one representative off-diagonal regions in the Run 2 measurement. The
shift of the peak of the reconstructed W -mass distribution caused by JES ( s , s 1 or
s 2 parameter) variation is shown on five template distributions with nominal value of
JER ( r = r 1 = r 2 = 1 ) and s , s 1 or s 2 ranging from 0.95 to 1.05. The widening of the
W-mass distribution caused by JER ( r , r 1 or r 2 parameter) variation is shown on five
template distributions with nominal value of JES ( s = s 1 = s 2 = 1 ) and r , r 1 or r 2
ranging from 0.6 to 1.4.
The effect of varying the JES correction factor, s 1 , for the leading jet is more
pronounced than that of varying s 2 for the subleading jet, indicating that the JES
measurement is more sensitive in the higher- p T bins. This is because a fixed relative
variation of 5% corresponds to a larger absolute change in jet p T at higher momenta,
resulting in a greater separation between the template distributions. The difference
in separation between the template distributions for s 1 and s 2 variations is shown in
Figure 5.3.
In contrast, the JER measurement is more sensitivite in the lower- p T bins, cor-
responding to variations of r 2 for the subleading jet. Since the jet p T resolution is
intrinsically poorer at lower p T , a variation in the resolution produces a larger absolute
change in the width of the reconstructed W -mass distribution, leading to a better sepa-
ration between the JER templates. The difference in separation between the template
distribution for r 1 and r 2 variations is shown in Figure 5.4.
All the Run 2 W -boson mass templates, as well as the Run 3 templates for diagonal
regions, are shown in Appendices D and E, respectively.


<!-- Page 37 -->



2000 ATLAS Simulation 2500 ATLAS Simulation
JES JER
1800 s = 13 TeV, 140 fb -1 s = 13 TeV, 140 fb -1
s = 0.95 r = 0.60
1600 anti-k R = 0.4 (PFlow+JES) 2000 anti-k R = 0.4 (PFlow+JES)
t s = 0.98 t r = 0.84
1400 jets p reco ∈ [50,70] GeV s = 1.00 jets p reco ∈ [50,70] GeV r = 1.00
Events / 2 GeV T Events / 2 GeV T
1200 | η | < 0.8 s = 1.02 1500 | η | < 0.8 r = 1.16
jet jet
1000 s = 1.05 r = 1.40
800 1000
600
400 500
200
60 80 100 60 80 100
1.5 1.4
W mass [GeV] W mass [GeV]
1.2
Variation w.r.t. s = 1 1 Variation w.r.t. r = 1 1
0.8
60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b)
Figure 5.2: Reconstructed W -boson mass in the diagonal region with the two jets from
the W -boson decay from the 50 − 70 GeV reconstructed p T bin, in the Run 2 simulation.
Templates with different (A) JES and (B) JER assumptions represented by the correction
factors s and r from the forward-folding formula are shown. For the JES variations, the JER
correction, r , is set to one, and for the JER variations the JES correction, s is set to one. The
differences between the total yields for each distribution come from the acceptance effects due
to the changes in the reconstructed jet p T . The bottom panels show the ratios to the template
with nominal (A) JES or (B) JER assumption. The solid line in the bottom panels represents
the ratio of one. [15]
2200
2200 -1 -1
2000 s = 13 TeV, 140 fb JES 2000 s = 13 TeV, 140 fb JES
1800 anti-k t R = 0.4 (PFlow+JES) s 1 = 0.95 1800 anti-k t R = 0.4 (PFlow+JES) s 2 = 0.95
s = 0.98 s = 0.98
1600 jet p reco ∈ [35,50] GeV 1 1600 jet p reco ∈ [35,50] GeV 2
2 T s = 1.00 2 T s = 1.00
Events / 2 GeV 1400 jet p reco ∈ [100,150] GeV 1 Events / 2 GeV 1400 jet p reco ∈ [100,150] GeV 2
1 T s = 1.02 1 T s = 1.02
1200 | η | < 0.8 1 1200 | η | < 0.8 2
jet s = 1.05 jet s = 1.05
1000 1 1000 2
800 800
600 600
400 400
200 200
1.5 60 80 100 60 80 100
W mass [GeV] 1.2 W mass [GeV]
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.8
60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b)
Figure 5.3: Reconstructed W -boson mass in a representative off-diagonal region of the Run 2
simulation. The leading jet from the W-boson decay is required to lie in the reconstructed
100–150 GeV p T bin, while the sub-leading jet lies in the reconstructed 35–50 GeV p T bin.
Templates corresponding to different JES assumptions for (A) the leading jet ( s 1 variations,
while s 2 = 1 ) and (B) the sub-leading jet ( s 2 variations with s 1 = 1 ). The JER correction
factor, r , is fixed to unity. [15]


<!-- Page 38 -->

2200 2500
-1 -1
2000 s = 13 TeV, 140 fb JER s = 13 TeV, 140 fb JER
1800 anti-k t R = 0.4 (PFlow+JES) r 1 = 0.60 anti-k t R = 0.4 (PFlow+JES) r 2 = 0.60
2000
1600 jet p reco ∈ [35,50] GeV r 1 = 0.84 jet p reco ∈ [35,50] GeV r 2 = 0.84
2 T 2 T
Events / 2 GeV 1400 jet p reco ∈ [100,150] GeV r 1 = 1.00 Events / 2 GeV jet p reco ∈ [100,150] GeV r 2 = 1.00
1 T 1500 1 T
1200 | η | < 0.8 r 1 = 1.16 | η | < 0.8 r 2 = 1.16
jet jet
1000 r 1 = 1.40 r 2 = 1.40
800 1000
600
400 500
200
60 80 100 60 80 100
1.2
W mass [GeV] 1.2 W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8
60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b)
Figure 5.4: Reconstructed W -boson mass in a representative off-diagonal region of the Run 2
simulation. The leading jet from the W-boson decay is required to lie in the reconstructed
100–150 GeV p T bin, while the sub-leading jet lies in the reconstructed 35–50 GeV p T bin.
Templates corresponding to different JER assumptions for (A) the leading jet ( r 1 variations,
while r 2 = 1 ) and (B) the sub-leading jet ( r 2 variations with r 1 = 1 ). The JES correction
factor, s , is fixed to unity. [15]


<!-- Page 39 -->


### Chapter 6


## Extraction of JES and JER

The implementation of the statistical analysis described in this chapter was mostly
performed by another member of the analysis team.
In order to extract the optimal JES correction ( s ) from a fit to data, the mean μ of
the W -mass distribution is parametrised as a function of s . Similarly, to extract the
optimal JER correction ( r ) from a fit to data, the standard deviation σ of the W -mass
distribution is parametrised as a function of r (Section 6.1).
The motivation to use the μ or σ of the W -mass distribution only, instead of the
full distribution, is to simplify the fit setup to allow for two JES ( s 1 and s 2 ) or JER ( r 1
and r 2 ) parameters in the off-diagonal regions, while retaining most of the sensitivity.
Once the parametrisation is obtained, a maximum likelihood fit to μ or σ of W -mass
distribution observed in data is performed to extract the JES or JER correction for all
regions simultaneously (Section 6.2).
In the JES measurement, the data without JES in situ calibration are used, whereas
for the JER measurement, the data with in situ calibration are used.

### 6.1 JES and JER parametrisation

For the JES measurement in the diagonal regions, the mean μ of the W -mass template is
extracted for every value of s and the obtained values are fitted with a one-dimensional
linear function F ( s ) . In the off-diagonal regions, μ is extracted for every combination
of s 1 and s 2 and the obtained values are fitted with two-dimensional quadratic function
F ( s 1 , s 2 ) .
For the JER measurement in the diagonal regions, the standard deviation σ of
the W -mass template is extracted for every value of r and the obtained values are
fitted with one-dimensional quadratic function F ( r ) . In the off-diagonal regions, σ is


<!-- Page 40 -->

extracted for every combination of r 1 and r 2 and the obtained values are fitted with
two-dimensional quadratic function F ( r 1 , r 2 ) .
The parametrisation was chosen to be as simple as possible while still providing a
good description of the data, with a linear form being sufficient for F ( s ) and a quadratic
form providing a better description for F ( r ) .
The diagonal and off-diagonal parametrisation functions, F ( s ) and F ( s 1 , s 2 ) , share
a set of six parameters s i , one for each reconstructed jet p T bin. Similarly, F ( r ) and
F ( r 1 , r 2 ) share a set of six parameters r i .
Example one-dimensional parametrisations, used for the diagonal regions, are shown
in Figure 6.1 and two-dimensional parametrisations, used in off-diagonal regions, are
shown in Figure 6.2. The Run 2 parametrisations for the remaining analysis regions
are shown in Appendix F. The fact that there is linear parametrisation for JES in the
diagonal regions shows how strongly is the JES correlated with W mass.
In the JER measurement, the diagonal region with jet p T between 150 and 200 GeV
is excluded from the fit due to a poor statistical power in the separation of the different
JER assumed values.
[GeV] ATLAS Simulation Template μ [GeV] ATLAS Simulation Template σ
μ 83 s = 13 TeV, 140 fb -1 σ 11 s = 13 TeV, 140 fb -1
Fit function Fit function
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
reco reco
82 jets p T ∈ [50,70] GeV, | η jet | < 0.8 10.5 jets p T ∈ [50,70] GeV, | η jet | < 0.8
W mass W mass
81 10
80
9.5
79
9
1.0005 0.94 0.96 0.98 1 1.02 1.04 1.06 0.6 0.7 0.8 0.9 1 1.1 1.2 1.3 1.4
/fit /fit 1.002
μ σ
1 1
s (JES) parameter 0.998 r (JER) parameter
0.9995
0.94 0.96 0.98 1 1.02 1.04 1.06 0.6 0.7 0.8 0.9 1 1.1 1.2 1.3 1.4
Template s (JES) parameter Template r (JER) parameter
(a) (b)
Figure 6.1: The mean (A) and standard deviation (B) of the W -mass distribution in a
representative diagonal region with reconstructed jet p T between 50 − 70 GeV as a function of
(A) JES ( s ) or (B) JER ( r ) parameters for the Run 2 measurement. The fitted function F is
shown by solid red line. The bottom panel shows the ratio of the (A) mean or (B) standard
deviation value to the fitted function F . [15]


<!-- Page 41 -->



ATLAS Simulation ATLAS Simulation
-1 -1
s = 13 TeV, 140 fb jet p reco ∈ [150,200] GeV, jet p reco ∈ [35,50] GeV s = 13 TeV, 140 fb jet p reco ∈ [150,200] GeV, jet p reco ∈ [35,50] GeV
1 T 2 T 1 T 2 T
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η | < 0.8 | η | < 0.8
jet jet
83
9.6
82.5
9.4
[GeV] 82 [GeV]
9.2
μ 81.5 σ
81 9
80.5 8.8
W mass 80 W mass 8.6
79.5 8.4
8.2
1.4
1.04
s (JES) parameter jet r (JER) parameter jet
1.02 1.2
1 1.04 1 1.4
1.02 1.2
0.98 1 0.8 1
0.98 2 2
1 0.96 0.96 s (JES) parameter jet 1 0.6 0.6 0.8 r (JER) parameter jet
Fit function Fit function
(a) (b)
Figure 6.2: The mean (A) and standard deviation (B) of the W -mass distribution in a
representative off-diagonal region with the leading jet (jet 1 ) with reconstructed p T between
150 − 200 GeV and the sub-leading jet (jet 2 ) with reconstructed p T between 35 − 50 GeV , as a
function of the (A) JES parameters, s 1 and s 2 , and (B) JER parameters, r 1 and r 2 , for the
Run 2 measurement. The fitted two-dimensional quadratic function F is shown in red. [15]

### 6.2 Fit setup

1
Once the parametrisation is available, a maximum-likelihood fit to μ or σ of the
W -mass distribution reconstructed from recorded data is performed to extract the
values of the JES and JER corrections, s i and r i , for each p T bin i simultaneously.
The likelihood is defined as
   Y
data
L μ ⃗ s | ⃗ ≡ G [ μ a |F a s ( ⃗ ) , σ μ a ] , (6.1)
a ∈ reg
data data data
where μ ⃗ is the vector of the μ a or σ a values measured in data, s ⃗ is the vector
of the scale or resolution correction factors s i or r i to be estimated, G represents a
Gaussian function, F a is the parametrisation formula from Section 6.1 for region a that
replaces the μ a or σ a values in G , and σ μ a is the data statistical uncertainty on the μ a
or σ a values in analysis region a for the JES or JER fit, respectively. Gaussian function
G is used under assumption that the distributions of μ a and σ a are Gaussian. For the
JES measurement, the function takes the form:
 
data
μ a − F a ( s i )
G ∝ exp . (6.2)
σ μ a
1
Technically, this is done by minimising the negative logarithm of the likelihood performed by the
MINUIT2 library [17] implemented in RooFit [18].


<!-- Page 42 -->

Similarly, for the JER measurement, it takes the form:
 
data
σ a − F a ( r i )
G ∝ exp . (6.3)
σ σ a
The fit is performed simultaneously across all analysis regions, indexed by a . Since
the regions are statistically independent, they total likelihood function is constructed
as a product of individual region likelihoods. Each analysis region corresponds to a
particular combinations of two p T bins of the jets from W -boson decay. The fit is
performed separately for the JES and JER measurement. In the JES fit, six JES
correction factors, s i ( i = 1 , . . . , 6 ), are extracted, with one correction factor associated
with each jet p T bin. Similarly, the JER fit extracts six JER correction factors, r i
( i = 1 , . . . , 6 ), one for each jet p T bin. The statistical uncertainty is obtained as the
difference between the correction factors for which the likelihood is maximised and the
ones for which the likelihood is half of the maximum value (which corresponds to one σ
variation).


<!-- Page 43 -->


### Chapter 7


## Results

In this chapter, the in situ jet energy scale (JES) and jet energy resolution (JER)
correction factors extracted from the hadronic W -boson mass reconstruction, s i and r i ,
respectively, are presented for each considered p T bin i . Results for Run 2 and Run 3
are shown, together with their total uncertainties.
In ATLAS, the JES calibration is applied to data while the JER calibration is
applied to MC. However, in the presented measurement, the correction factors for the
MC simulation were derived for both, JES and JER. Thus, to correct the JES in data,
the inverse of the fitted values, alongside their uncertainties, needs to be applied to
data.

### 7.1 Pre-fit and post-fit W -mass distribution parame-

ters
The likelihood fit (Section 6.2) to data is performed separately for JES and JER
measurements and for Run 2 and Run 3, using the likelihood model described by
Equation 6.1.
For the JES measurements, the fitted parameters are the JES correction factors, s i ,
which determine the predicted mean, μ , of the W -mass distribution in each analysis
region through the parametrisation F described in Section 6.1. Analogous procedure
is performed in the JER measurement to obtain the JER correction factors, r i , using
the parametrisation of the W -mass distribution width, σ . Figures 7.1 and 7.2 show the
distributions entering these fits ( pre-fit distributions), together with their corresponding
post-fit values. Figure 7.1 compares the mean, μ , of the original ( pre-fit ) W mass
distributions in each analysis region with the corresponding ( post-fit ) value, obtained
by substituting the fitted s i into the parametrisation F . The comparison is presented


<!-- Page 44 -->

separately for the Run 2 and Run 3 JES measurements. Similarly, Figure 7.2 compares
the pre-fit and post-fit values of the W -mass distribution width, σ , obtained in the
presented Run 2 and Run 3 JER measurements. It can be seen that the post-fit
prediction agreement with the observed data improves significantly (especially for the
JES fit in Run 2). All remaining discrepancies between the post-fit prediction and data
are covered by the considered uncertainties.
The uncertainty bands in Figures 7.1 and 7.2 are estimated from pseudo-experiments .
This approach is adopted because, although the uncertainties on the individual JES
and JER correction factors, s i and r i , are Gaussian, the propagated uncertainties on μ
or σ are non-Gaussian when the parametrisation is non-linear.
For each pseudo-experiment , JES or JER correction factors are sampled from
Gaussian distributions whose means are given by the fitted correction factors, s i
or r i , and whose standard deviations corresponds to their total uncertainties. The
sampled correction factors are then propagated through the parametrisation described
in Section 6.1 to obtain the corresponding values of the W -mass distribution mean, μ ,
or standard deviation, σ . After performing 1000 pseudo-experiments , distribution of
the resulting μ and σ values are obtained. The uncertainty bands are defined by the
standard deviation of these distributions.


<!-- Page 45 -->


## 7.1. Pre-fit and post-fit W -mass distribution parameters 45

105
ATLAS Data
[GeV] 100 s = 13 TeV, 140 fb -1 Pre-fit prediction
μ
anti-k R = 0.4 (PFlow+JES) Post-fit prediction
95 t
| η | < 0.8 Uncertainty
jet
90
W mass
85
80
75
1.02
1
Data/Pred. 0.98 35-50 GeV 50-70 GeV 70-100 GeV 100-150 GeV 150-200 GeV 20-35, 35-50 GeV 20-35, 50-70 GeV 20-35, 70-100 GeV 20-35, 100-150 GeV 20-35, 150-200 GeV 35-50, 50-70 GeV 35-50, 70-100 GeV 35-50, 100-150 GeV 35-50, 150-200 GeV 50-70, 70-100 GeV 50-70, 100-150 GeV 50-70, 150-200 GeV 70-100, 100-150 GeV 70-100, 150-200 GeV 100-150, 150-200 GeV
(a)
105
ATLAS Data
[GeV] 100 s = 13.6 TeV, 52 fb -1 Pre-fit prediction
μ
anti-k R = 0.4 (PFlow+JES) Post-fit prediction
95 t
| η | < 0.8 Uncertainty
jet
90
W mass
85
80
75
1.02
1
Data/Pred. 0.98 35-50 GeV 50-70 GeV 70-100 GeV 100-150 GeV 150-200 GeV 20-35, 35-50 GeV 20-35, 50-70 GeV 20-35, 70-100 GeV 20-35, 100-150 GeV 20-35, 150-200 GeV 35-50, 50-70 GeV 35-50, 70-100 GeV 35-50, 100-150 GeV 35-50, 150-200 GeV 50-70, 70-100 GeV 50-70, 100-150 GeV 50-70, 150-200 GeV 70-100, 100-150 GeV 70-100, 150-200 GeV 100-150, 150-200 GeV
(b)
Figure 7.1: Mean of the W -mass distribution shown for the analysis regions defined in
Section ?? in the (A) Run 2 and (B) Run 3 JES measurement. The values obtained in data
are compared to those obtained in simulation without the JES corrections ( pre-fit ) and those
after applying the fitted JES corrections, s i , ( post-fit ). The first five bins show the diagonal
regions, while the remaining bins show the off-diagonal regions. The bottom panel shows the
ratio of the data without the in situ JES calibration (PFlow+JES) to the pre-fit (dotted line)
and post-fit (solid line) predictions, with the dashed line representing the ratio of one.


<!-- Page 46 -->

16
ATLAS Data
[GeV] -1
14 s = 13 TeV, 140 fb Pre-fit prediction
σ
anti-k R = 0.4 (PFlow+JES in situ ) Post-fit prediction
t
12 | η | < 0.8 Uncertainty
jet
W mass
10
8
6
1.05
1
0.95
Data/Pred. 35-50 GeV 50-70 GeV 70-100 GeV 100-150 GeV 20-35, 35-50 GeV 20-35, 50-70 GeV 20-35, 70-100 GeV 20-35, 100-150 GeV 20-35, 150-200 GeV 35-50, 50-70 GeV 35-50, 70-100 GeV 35-50, 100-150 GeV 35-50, 150-200 GeV 50-70, 70-100 GeV 50-70, 100-150 GeV 50-70, 150-200 GeV 70-100, 100-150 GeV 70-100, 150-200 GeV 100-150, 150-200 GeV
(a)
16
ATLAS Data
[GeV] -1
14 s = 13.6 TeV, 52 fb Pre-fit prediction
σ
anti-k R = 0.4 (PFlow+JES in situ ) Post-fit prediction
t
12 | η | < 0.8 Uncertainty
jet
W mass
10
8
6
1.05
1
0.95
Data/Pred. 35-50 GeV 50-70 GeV 70-100 GeV 100-150 GeV 20-35, 35-50 GeV 20-35, 50-70 GeV 20-35, 70-100 GeV 20-35, 100-150 GeV 20-35, 150-200 GeV 35-50, 50-70 GeV 35-50, 70-100 GeV 35-50, 100-150 GeV 35-50, 150-200 GeV 50-70, 70-100 GeV 50-70, 100-150 GeV 50-70, 150-200 GeV 70-100, 100-150 GeV 70-100, 150-200 GeV 100-150, 150-200 GeV
(b)
Figure 7.2: Standard deviation of the W -mass distribution shown for the analysis regions
defined in Section ?? in the (A) Run 2 and (B) Run 3 JER measurement. The values obtained
in data are compared to those obtained in simulation without the JER corrections ( pre-fit )
and those after applying the fitted JER corrections, r i , ( post-fit ). The first five bins show the
diagonal regions, while the remaining bins show the off-diagonal regions. The bottom panel
shows the ratio of the data without the in situ JES calibration (PFlow+JES) to the pre-fit
(dotted line) and post-fit (solid line) predictions, with the dashed line representing the ratio of
one.


<!-- Page 47 -->




### 7.2 JES and JER correction factors

The fitted central values of the JES correction factors, s i , with their uncertainties, are
shown in Figure 7.3 for Run 2 and Run 3. Although the overall uncertainties are similar
between the Run 2 and Run 3 measurements, the central values for the measured JES
corrections are closer to unity in the Run 3 measurement, suggesting an improved
detector simulation ( GEANT4 ) in Run 3. Additionally, the JES corrections are larger
for low p T bins compared to high p T bins, which could be attributed to the QCD effects
that are more difficult to model for low p T jets. The obtained JER correction factors
are shown in Figure 7.3, also with the uncertainties and for both, Run 2 and Run 3.
The JES and JER corrections are derived in discrete p T bins, however a continuous
correction function will be later constructed by interpolation across these bins, in order
to apply the derived corrections. The discrete correction factors must be therefore
assigned to a representative p T value. Since the jet p T spectrum falls steeply, as shown
in Figure 7.5, the jet population within any p T bin is skewed towards the lower edge
and the average correction derived for a bin corresponds to the mean p T in the bin
rather than to its geometric centre. Bin-centre corrections are therefore applied to the
horizontal values in Figures 7.3 and 7.4, to shift the derived corrections from bin centre
to the mean of the jet p T distribution of the jets from the W -boson decay in each p T
bin in data. Figure 7.5 shows the p T distribution of jets from W -boson decays in data,
compared with the corresponding distribution obtained from the MC simulation, for all
considered p T bins.
The central values of the obtained correction factors and the statistical, systematic
and total uncertainties in Run 2 and Run 3 are summarised in Tables 7.1 and 7.2,
for the JES and JER estimate, respectively. For the JES, the 20 − 35 GeV p T bin
reaches about 5(7)% uncertainty, while the uncertainty drops to about 1.6(1.3)% for
the 35 − 50 GeV bin and reaches about 0.9(0.9)% for the 100 − 150 GeV bin in the case
of excluding (including) pre-recommendation JES and JER components. For the JER,
the uncertainty ranges between 14 to 22% in the whole considered p T range.
Figure 7.6 shows the statistical correlations between the correction factors associated
with the individual reconstructed jet p T bins. These correlations arise from the use of
the off-diagonal analysis regions, which simultaneously constrain the correction factors
associated with the p T bins of the leading and sub-leading jets. The correlations are
obtained from the covariance matrix of the fitted parameters, which is determined from
the inverse of the Hessian matrix at the likelihood minimum. The correlation coefficients


<!-- Page 48 -->

Table 7.1: The JES correction factors, s i , obtained from the fit to data for each reconstructed
jet p T bin i , are shown for the Run 2 and Run 3 measurement, together with their uncertainties.
The total uncertainty is calculated by adding the statistical and systematic uncertainties in
quadrature and includes the pre-recommendation JER uncertainties.
Central Statistical Systematic Total
Region i [GeV ] Run 2 Run 3 Run 2 Run 3 Run 2 Run 3 Run 2 Run 3
20 < p T < 35 0.929 0.950 0.0064 0.0119 0.0780 0.0730 0.0783 0.0739
35 < p T < 50 0.967 0.979 0.0023 0.0037 0.0150 0.0150 0.0151 0.0154
50 < p T < 70 0.967 0.985 0.0013 0.0020 0.0157 0.0120 0.0157 0.0121
70 < p T < 100 0.971 0.991 0.0011 0.0017 0.0108 0.0105 0.0109 0.0107
100 < p T < 150 0.976 1.001 0.0012 0.0018 0.0092 0.0097 0.0093 0.0098
150 < p T < 200 0.981 1.002 0.0023 0.0036 0.0173 0.0162 0.0174 0.0165
Table 7.2: The JER correction factors, r i , obtained from the fit to data for each reconstructed
jet p T bin i , are shown for the Run 2 and Run 3 measurement, together with their uncertainties.
The total uncertainty is calculated by adding the statistical and systematic uncertainties in
quadrature and includes the pre-recommendation JES uncertainties.
Central Statistical Systematic Total
Region i [GeV ] Run 2 Run 3 Run 2 Run 3 Run 2 Run 3 Run 2 Run 3
20 < p T < 35 1.085 1.101 0.0214 0.0373 0.2029 0.2323 0.2041 0.2352
35 < p T < 50 1.082 1.088 0.0178 0.0299 0.1784 0.1616 0.1793 0.1644
50 < p T < 70 1.065 1.129 0.0181 0.0296 0.1396 0.1748 0.1408 0.1773
70 < p T < 100 1.081 1.085 0.0204 0.0333 0.1405 0.1807 0.1420 0.1838
100 < p T < 150 1.078 1.103 0.0275 0.0450 0.1839 0.1641 0.1859 0.1701
150 < p T < 200 0.997 0.995 0.0765 0.1220 0.2116 0.2528 0.2250 0.2808


<!-- Page 49 -->



are obtained by dividing the corresponding covariance terms by the uncertainties of the
two parameters. These correlations need to be taken into account when combining the
correction factors s i and r i obtained from the hadronic W -boson decay measurement
with the corrections obtained using the standard in situ techniques (see Section ?? ). It
is worth noting that in the JES measurement, there are relatively large anti-correlations
between s 1 and s 2 or s 3 . This is because the diagonal 20 − 35 GeV bin is not included in
the measurement and consequently, s 1 is only estimated from the off-diagonal regions,
where the effects of a JES variation in the 20 − 35 GeV bin are difficult to distinguish
from the effect of JES variation in the 35 − 50 GeV or 50 − 70 GeV bin, due to the
effect of JES variation on low p T jets being smaller compared to high p T jets (see
Appendix ?? ).


<!-- Page 50 -->

1.1
ATLAS Total unc.
-1
s = 13 TeV, 140 fb Stat. unc.
1.05 anti-k t R = 0.4 (PFlow+JES)
| η | < 0.8
jet
JES correction
1
0.95
0.9
0.85
0 20 40 60 80 100 120 140 160 180 200 220
reco
jet p [GeV]
T
(a)
1.1
ATLAS Total unc.
-1
s = 13.6 TeV, 52 fb Stat. unc.
1.05 anti-k t R = 0.4 (PFlow+JES)
| η | < 0.8
jet
JES correction
1
0.95
0.9
0.85
0 20 40 60 80 100 120 140 160 180 200 220
reco
jet p [GeV]
T
(b)
Figure 7.3: The JES correction factors s i and the corresponding uncertainties shown for
the different reconstructed jet p T bins, in the Run 2 (A) and Run 3 (B) measurement. The
statistical uncertainty is shown with a thick solid bar with arrows on both ends, while the
total uncertainty is shown with a thin dashed line. The horizontal values are taken from the
mean of the reconstructed jet p T distribution of the jets from W -boson decay in each p T bin.
The dashed horizontal line represents JES correction s i = 1 , i.e. no correction needed.


<!-- Page 51 -->



1.6 ATLAS Total unc.
-1 Total unc. w/o Herwig
s = 13 TeV, 140 fb Stat. unc.
anti-k t R = 0.4 (PFlow+JES in situ )
1.4 | η | < 0.8
jet
JER correction
1.2
1
0.8
0.6
0 20 40 60 80 100 120 140 160 180 200 220
reco
jet p [GeV]
T
(a)
1.6 ATLAS Total unc.
-1 Total unc. w/o Herwig
s = 13.6 TeV, 52 fb Stat. unc.
anti-k t R = 0.4 (PFlow+JES in situ )
1.4 | η | < 0.8
jet
JER correction
1.2
1
0.8
0.6
0 20 40 60 80 100 120 140 160 180 200 220
reco
jet p [GeV]
T
(b)
Figure 7.4: The JER correction factors r i and the corresponding uncertainties shown for
the different reconstructed jet p T bins, in the Run 2 (A) and Run 3 (B) measurement. The
statistical uncertainty is shown with a thick solid bar with arrows on both ends, while the
total uncertainty is shown with a thin dashed line. The thin solid line represents the total
uncertainty without the Pythia versus Herwig component. The horizontal values are taken
from the mean of the reconstructed jet p T distribution of the jets from W -boson decay in each
p T bin. The dashed horizontal line represents JER correction r i = 1 , i.e. no correction needed.


<!-- Page 52 -->

3 3
× 10 × 10
3000 Data 3000 Data
-1 -1
s = 13 TeV, 140 fb t t s = 13 TeV, 140 fb t t
SingleTop SingleTop
2500 anti-k t R = 0.4 (PFlow+JES) W+jets 2500 anti-k t R = 0.4 (PFlow+JES in situ ) W+jets
Z+jets Z+jets
Diboson Diboson
2000 Fake leptons 2000 Fake leptons
Jets / 15 GeV Uncertainty Jets / 15 GeV Uncertainty
1500 1500
1000 1000
500 500
50 100 150 200 50 100 150 200
1.2 1.2
1 p [GeV] 1 p [GeV]
T T
0.8 0.8
50 100 150 200 50 100 150 200
Data/Pred. Data/Pred.
p of jets from W [GeV] p of jets from W [GeV]
T T
(a) (b)
Figure 7.5: The p T distribution of jets coming from the W -boson decay in data without (A)
and with (B) in situ JES calibration compared with the corresponding distributions in
simulation, across all considered reconstructed jet p T bins in the Run 2 measurement.


<!-- Page 53 -->



-1 -1
ATLAS s = 13 TeV, 140 fb JES ATLAS s = 13.6 TeV, 52 fb JES
150 - 200 GeV -0.04 -0.05 -0.07 -0.09 -0.03 1.00 150 - 200 GeV -0.09 -0.04 -0.04 -0.11 -0.04 1.00
100 - 150 GeV -0.01 -0.09 -0.10 -0.12 1.00 -0.03 100 - 150 GeV -0.03 -0.09 -0.09 -0.12 1.00 -0.04
70 - 100 GeV 0.04 -0.09 -0.10 1.00 -0.12 -0.09 70 - 100 GeV 0.02 -0.08 -0.10 1.00 -0.12 -0.11
50 - 70 GeV -0.28 0.08 1.00 -0.10 -0.10 -0.07 50 - 70 GeV -0.25 0.01 1.00 -0.10 -0.09 -0.04
35 - 50 GeV -0.33 1.00 0.08 -0.09 -0.09 -0.05 35 - 50 GeV -0.24 1.00 0.01 -0.08 -0.09 -0.04
20 - 35 GeV 1.00 -0.33 -0.28 0.04 -0.01 -0.04 20 - 35 GeV 1.00 -0.24 -0.25 0.02 -0.03 -0.09
20 - 35 GeV 35 - 50 GeV 50 - 70 GeV 70 - 100 GeV 100 - 150 GeV 150 - 200 GeV 20 - 35 GeV 35 - 50 GeV 50 - 70 GeV 70 - 100 GeV 100 - 150 GeV 150 - 200 GeV
(a) (b)
-1 -1
ATLAS s = 13 TeV, 140 fb JER ATLAS s = 13.6 TeV, 52 fb JER
150 - 200 GeV -0.00 -0.04 -0.11 -0.16 -0.02 1.00 150 - 200 GeV -0.03 -0.03 -0.12 -0.16 -0.02 1.00
100 - 150 GeV -0.04 -0.08 -0.13 -0.16 1.00 -0.02 100 - 150 GeV -0.03 -0.07 -0.13 -0.20 1.00 -0.02
70 - 100 GeV -0.08 -0.10 -0.12 1.00 -0.16 -0.16 70 - 100 GeV -0.07 -0.12 -0.10 1.00 -0.20 -0.16
50 - 70 GeV -0.08 -0.10 1.00 -0.12 -0.13 -0.11 50 - 70 GeV -0.08 -0.09 1.00 -0.10 -0.13 -0.12
35 - 50 GeV 0.02 1.00 -0.10 -0.10 -0.08 -0.04 35 - 50 GeV 0.03 1.00 -0.09 -0.12 -0.07 -0.03
20 - 35 GeV 1.00 0.02 -0.08 -0.08 -0.04 -0.00 20 - 35 GeV 1.00 0.03 -0.08 -0.07 -0.03 -0.03
20 - 35 GeV 35 - 50 GeV 50 - 70 GeV 70 - 100 GeV 100 - 150 GeV 150 - 200 GeV 20 - 35 GeV 35 - 50 GeV 50 - 70 GeV 70 - 100 GeV 100 - 150 GeV 150 - 200 GeV
(c) (d)
Figure 7.6: The statistical correlations between different reconstructed jet p T bins estimated
from the fit in the Run 2 (left) and Run 3 (right) JES (top) and JER (bottom) measurements.


<!-- Page 54 -->


### 7.3 Fit validation

Figures 7.7 and 7.8 compare the pre-fit and post-fit predictions of the reconstructed W -
boson mass distribution with the corresponding distribution in data for a representative
diagonal analysis region in the JES and JER measurements, respectively. The post-fit
predictions are obtained by propagating the fitted JES or JER correction factor, s or
r , through the parametrisation of the predicted yield in each bin as a function of the
corresponding correction factor. This parametrisation is derived specifically to obtain
the post-fit W -boson mass distribution, as the W -boson mass distribution itself is not
the distribution that is fitted in the measurement. The associated uncertainty bands
are derived from the predicted yield when using the fitted correction factor varied by
its total uncertainty, i.e. s i ± σ s or r i ± σ r . An improved agreement between the
i i
post-fit prediction and the data is observed in Run 2. The improvement is seen across
the full W -mass distribution, even though only the mean of the distribution was fitted.
In contrast, no such improvement is observed in Run 3, where the corrections are
substantially smaller compared to the Run 2 corrections. No improvement is observed in
the JER distributions either, which is consistent with the corresponding JER corrections
being close to unity.


<!-- Page 55 -->



-1
ATLAS Data 450 s = 13.6 TeV, 52 fb Data
1000 s = 13 TeV, 140 fb -1 Pre-fit prediction anti-k t R = 0.4 (PFlow+JES) Pre-fit prediction
400 reco
anti-k reco t R = 0.4 (PFlow+JES) Post-fit prediction jets p T ∈ [70,100] GeV Post-fit prediction
800 jets p T ∈ [70,100] GeV JES uncertainty 350 | η jet | < 0.8 JES uncertainty
| η | < 0.8 Events / 2 GeV 300
jet
600 250
200
400
Events normalised to data 150
100
200
50
1.5 50 60 70 80 90 100 110 1.5 50 60 70 80 90 100 110
1 1
Data/Postfit 0.5 Data/Postfit 0.5
50 60 70 80 90 100 110 50 60 70 80 90 100 110
W mass [GeV] W mass [GeV]
(a) (b)
Figure 7.7: The pre fit and post fit predictions for the W -boson mass distribution in the
representative diagonal region with reconstructed jet p T from 70 − 100 GeV in the (A) Run 2
and (B) Run 3 JES measurements. The uncertainty band is estimated by propagating the
total uncertainties, σ s i , on the fitted JES correction factors, s i , to the yield predictions for
each bin parametrised as a function of JES correction factors. The predictions are normalised
to the same yield as data. The bottom panels show the ratio of the data without the in situ
JES calibration (PFlow + JES) to the post-fit prediction, with the dashed horizontal line
representing the ratio of one. The arrows indicate a value outside of the displayed range [15].


<!-- Page 56 -->

600
1400 ATLAS s = 13.6 TeV, 52 fb -1
Data Data
s = 13 TeV, 140 fb -1 anti-k R = 0.4 (PFlow+JES in situ )
1200 Pre-fit prediction 500 reco t Pre-fit prediction
anti-k reco t R = 0.4 (PFlow+JES in situ ) Post-fit prediction jets p T ∈ [70,100] GeV Post-fit prediction
1000 jets p T ∈ [70,100] GeV JER uncertainty 400 | η jet | < 0.8 JER uncertainty
| η | < 0.8 Events / 2 GeV
jet
800
300
600
Events normalised to data 200
400
100
200
1.5 50 60 70 80 90 100 110 1.5 50 60 70 80 90 100 110
1 1
Data/Postfit 0.5 Data/Postfit 0.5
50 60 70 80 90 100 110 50 60 70 80 90 100 110
W mass [GeV] W mass [GeV]
(a) (b)
Figure 7.8: The pre fit and post fit predictions for the W -boson mass distribution in the
representative diagonal region with reconstructed jet p T from 70 − 100 GeV in the (A) Run 2
and (B) Run 3 JER measurement. The uncertainty band is estimated by propagating the
total uncertainties, σ r i , on the fitted JER correction factors, r i , to the yield predictions for
each bin parametrised as a function of JER correction factors. The predictions are normalised
to the same yield as data. The bottom panels show the ratio of the data with the in situ JES
calibration (PFlow + JES in situ ) to the post-fit prediction, with the dashed horizontal line
representing the ratio of one. The arrows indicate a value outside of the displayed range [15].


<!-- Page 57 -->


### Appendix A


## Run 2 response distributions

0.12
s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.1 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.08 0.08
0.08 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
Arbitrary units | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 0.06 1.3 < | η | < 2.5
0.06 20 < p T < 35 [GeV] 0.06 20 < p T < 35 [GeV] 20 < p T < 35 [GeV]
b-jet b-jet b-jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-]
(a) (b) (c)
0.1
0.1 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.09 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.08 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.08 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.08 t t PowhegHerwig FS t t PowhegHerwig FS 0.07 t t PowhegHerwig FS
0.06
Arbitrary units 0.06 | η | < 0.8 Arbitrary units 0.06 0.8 < | η | < 1.3 Arbitrary units 0.05 1.3 < | η | < 2.5
20 < p T < 35 [GeV] 20 < p T < 35 [GeV] 20 < p T < 35 [GeV]
0.04 c-jet 0.04 c-jet 0.04 c-jet
0.03
0.02 0.02 0.02
0.01
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-]
(d) (e) (f)
0.1
-1 0.1 -1 -1
0.1 s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS
anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.08 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.08 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.08 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.06 0.06
Arbitrary units 0.06 | 20 < p η | < 0.8 < 35 [GeV] Arbitrary units 0.8 < | 20 < p η | < 1.3 < 35 [GeV] Arbitrary units 1.3 < | 20 < p η | < 2.5 < 35 [GeV]
T T 0.04 T
0.04 light jet 0.04 light jet light jet
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
light jet reco p T /truth p T [-] light jet reco p T /truth p T [-] light jet reco p T /truth p T [-]
(g) (h) (i)
Figure A.1: The Run 2 simulated jet response distribution for jets from different p T bins
and | η | bins. The distributions are shown for different t t ¯ samples. The red line represents the
Gaussian fit to the response distribution of the nominal t t ¯ sample. The bottom panel shows
the ratios of jet response distributions in the alternative samples over the jet response in the
nominal t t ¯ sample.


<!-- Page 58 -->

58 Appendix A. Run 2 response distributions
0.1 s = 13 TeV, 140 fb -1 0.09 s = 13 TeV, 140 fb -1 0.09 s = 13 TeV, 140 fb -1
t t PowhegPythia8 FS t t PowhegPythia8 FS t t PowhegPythia8 FS
anti-k R = 0.4 (PFlow+JES) 0.08 anti-k R = 0.4 (PFlow+JES) 0.08 anti-k R = 0.4 (PFlow+JES)
0.08 t t t PowhegPythia8 AF 0.07 t t t PowhegPythia8 AF 0.07 t t t PowhegPythia8 AF
t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.06
Arbitrary units 0.06 | η | < 0.8 Arbitrary units 0.06 0.8 < | η | < 1.3 Arbitrary units 0.05 1.3 < | η | < 2.5
20 < p T < 35 [GeV] 0.05 20 < p T < 35 [GeV] 20 < p T < 35 [GeV]
0.04 gluon jet 0.04 gluon jet 0.04 gluon jet
0.03 0.03
0.02 0.02 0.02
0.01 0.01
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-]
(a) (b) (c)
0.12
s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.1 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.08 0.08
0.08 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
Arbitrary units | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 0.06 1.3 < | η | < 2.5
0.06 20 < p T < 35 [GeV] 0.06 20 < p T < 35 [GeV] 20 < p T < 35 [GeV]
b-jet b-jet b-jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-]
(d) (e) (f)
0.1
0.1 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.09 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.08 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.08 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.08 t t PowhegHerwig FS t t PowhegHerwig FS 0.07 t t PowhegHerwig FS
0.06
Arbitrary units 0.06 | η | < 0.8 Arbitrary units 0.06 0.8 < | η | < 1.3 Arbitrary units 0.05 1.3 < | η | < 2.5
20 < p T < 35 [GeV] 20 < p T < 35 [GeV] 20 < p T < 35 [GeV]
0.04 c-jet 0.04 c-jet 0.04 c-jet
0.03
0.02 0.02 0.02
0.01
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-]
(g) (h) (i)
0.1
-1 0.1 -1 -1
0.1 s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS
anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.08 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.08 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.08 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.06 0.06
Arbitrary units 0.06 | 20 < p η | < 0.8 < 35 [GeV] Arbitrary units 0.8 < | 20 < p η | < 1.3 < 35 [GeV] Arbitrary units 1.3 < | 20 < p η | < 2.5 < 35 [GeV]
T T 0.04 T
0.04 light jet 0.04 light jet light jet
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
light jet reco p T /truth p T [-] light jet reco p T /truth p T [-] light jet reco p T /truth p T [-]
(j) (k) (l)
0.1 s = 13 TeV, 140 fb -1 0.09 s = 13 TeV, 140 fb -1 0.09 s = 13 TeV, 140 fb -1
t t PowhegPythia8 FS t t PowhegPythia8 FS t t PowhegPythia8 FS
anti-k R = 0.4 (PFlow+JES) 0.08 anti-k R = 0.4 (PFlow+JES) 0.08 anti-k R = 0.4 (PFlow+JES)
0.08 t t t PowhegPythia8 AF 0.07 t t t PowhegPythia8 AF 0.07 t t t PowhegPythia8 AF
t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.06
Arbitrary units 0.06 | η | < 0.8 Arbitrary units 0.06 0.8 < | η | < 1.3 Arbitrary units 0.05 1.3 < | η | < 2.5
20 < p T < 35 [GeV] 0.05 20 < p T < 35 [GeV] 20 < p T < 35 [GeV]
0.04 gluon jet 0.04 gluon jet 0.04 gluon jet
0.03 0.03
0.02 0.02 0.02
0.01 0.01
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-]
(m) (n) (o)
Figure A.2: The Run 2 simulated jet response distribution for jets from different p T bins
and | η | bins. The distributions are shown for different t t ¯ samples. The red line represents the
Gaussian fit to the response distribution of the nominal t t ¯ sample. The bottom panel shows
the ratios of jet response distributions in the alternative samples over the jet response in the
nominal t t ¯ sample.


<!-- Page 59 -->

Appendix A. Run 2 response distributions 59
0.12 -1 -1 -1
s = 13 TeV, 140 fb t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb t t PowhegPythia8 FS
0.1 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.08 0.08
0.08 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
Arbitrary units | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 0.06 1.3 < | η | < 2.5
0.06 35 < p T < 50 [GeV] 0.06 35 < p T < 50 [GeV] 35 < p T < 50 [GeV]
b-jet b-jet b-jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-]
(a) (b) (c)
0.12 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.1 0.1
0.1 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
t t PowhegHerwig FS 0.08 t t PowhegHerwig FS 0.08 t t PowhegHerwig FS
0.08
Arbitrary units | η | < 0.8 Arbitrary units 0.06 0.8 < | η | < 1.3 Arbitrary units 0.06 1.3 < | η | < 2.5
0.06 35 < p T < 50 [GeV] 35 < p T < 50 [GeV] 35 < p T < 50 [GeV]
c-jet c-jet c-jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-]
(d) (e) (f)
0.12
0.12 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.1 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.1
t t PowhegHerwig FS 0.08 t t PowhegHerwig FS 0.08 t t PowhegHerwig FS
0.08 | η | < 0.8 0.8 < | η | < 1.3 1.3 < | η | < 2.5
Arbitrary units Arbitrary units 0.06 Arbitrary units 0.06
0.06 35 < p T < 50 [GeV] 35 < p T < 50 [GeV] 35 < p T < 50 [GeV]
light jet light jet light jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
light jet reco p T /truth p T [-] light jet reco p T /truth p T [-] light jet reco p T /truth p T [-]
(g) (h) (i)
0.12 -1 -1 -1
s = 13 TeV, 140 fb t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb t t PowhegPythia8 FS
0.1 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.08 0.08
0.08 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
Arbitrary units | η | < 0.8 Arbitrary units 0.06 0.8 < | η | < 1.3 Arbitrary units 0.06 1.3 < | η | < 2.5
0.06 35 < p T < 50 [GeV] 35 < p T < 50 [GeV] 35 < p T < 50 [GeV]
gluon jet gluon jet gluon jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-]
(j) (k) (l)
0.12 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.1 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.1
0.1 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
t t PowhegHerwig FS 0.08 t t PowhegHerwig FS 0.08 t t PowhegHerwig FS
0.08
Arbitrary units | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 0.06 1.3 < | η | < 2.5
0.06 50 < p T < 70 [GeV] 0.06 50 < p T < 70 [GeV] 50 < p T < 70 [GeV]
b-jet b-jet 0.04 b-jet
0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-]
(m) (n) (o)
Figure A.3: The Run 2 simulated jet response distribution for jets from different p T and
| η | bins. The distributions are shown for different t t ¯ samples. The red line represents the
Gaussian fit to the response distribution of the nominal t t ¯ sample. The bottom panel shows
the ratios of jet response distributions in the alternative samples over the jet response in the
nominal t t ¯ sample.


<!-- Page 60 -->

60 Appendix A. Run 2 response distributions
0.14 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.12 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.12
0.12 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.1 0.1
0.1 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.08 0.08
Arbitrary units 0.08 | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 1.3 < | η | < 2.5
50 < p < 70 [GeV] 50 < p < 70 [GeV] 0.06 50 < p < 70 [GeV]
0.06 c-jet T 0.06 c-jet T c-jet T
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-]
(a) (b) (c)
0.14
0.14 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.12 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.12
0.12 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.1 0.1
0.1 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.08 0.08
Arbitrary units 0.08 | 50 < p η | < 0.8 < 70 [GeV] Arbitrary units 0.8 < | 50 < p η | < 1.3 < 70 [GeV] Arbitrary units 1.3 < | 50 < p η | < 2.5 < 70 [GeV]
T T 0.06 T
0.06 light jet 0.06 light jet light jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
light jet reco p T /truth p T [-] light jet reco p T /truth p T [-] light jet reco p T /truth p T [-]
(d) (e) (f)
0.14 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.12 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.12
0.12 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.1 0.1
0.1 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.08 0.08
Arbitrary units 0.08 | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 1.3 < | η | < 2.5
50 < p T < 70 [GeV] 50 < p T < 70 [GeV] 0.06 50 < p T < 70 [GeV]
0.06 gluon jet 0.06 gluon jet gluon jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-]
(g) (h) (i)
0.14 -1 -1 0.12 -1
s = 13 TeV, 140 fb t t PowhegPythia8 FS 0.12 s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS
0.12 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.1 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.1
0.1 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.08 0.08
Arbitrary units 0.08 | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 1.3 < | η | < 2.5
70 < p < 100 [GeV] 70 < p < 100 [GeV] 0.06 70 < p < 100 [GeV]
0.06 b-jet T 0.06 b-jet T b-jet T
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-]
(j) (k) (l)
0.16 -1 -1 0.14 -1
s = 13 TeV, 140 fb t t PowhegPythia8 FS 0.14 s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS
0.14 anti-k R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.12 anti-k R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
t 0.12 t t
0.12 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.1 0.1
0.1 | η | < 0.8 0.8 < | η | < 1.3 1.3 < | η | < 2.5
Arbitrary units Arbitrary units Arbitrary units 0.08
0.08 70 < p T < 100 [GeV] 0.08 70 < p T < 100 [GeV] 70 < p T < 100 [GeV]
0.06 c-jet 0.06 c-jet 0.06 c-jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-]
(m) (n) (o)
Figure A.4: The Run 2 simulated jet response distribution for jets from different p T bins
and | η | bins. The distributions are shown for different t t ¯ samples. The red line represents the
Gaussian fit to the response distribution of the nominal t t ¯ sample. The bottom panel shows
the ratios of jet response distributions in the alternative samples over the jet response in the
nominal t t ¯ sample.


<!-- Page 61 -->

Appendix A. Run 2 response distributions 61
0.16
0.16 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.14 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.14
0.14 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.12 0.12
0.12 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.1
Arbitrary units 0.1 | η | < 0.8 Arbitrary units 0.1 0.8 < | η | < 1.3 Arbitrary units 1.3 < | η | < 2.5
0.08 70 < p T < 100 [GeV] 0.08 70 < p T < 100 [GeV] 0.08 70 < p T < 100 [GeV]
0.06 light jet 0.06 light jet 0.06 light jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
light jet reco p T /truth p T [-] light jet reco p T /truth p T [-] light jet reco p T /truth p T [-]
(a) (b) (c)
0.16 0.16
0.16 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.14 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.14 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.14 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.12 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.12
0.12 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.1 0.1
Arbitrary units 0.1 | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 1.3 < | η | < 2.5
0.08 70 < p T < 100 [GeV] 0.08 70 < p T < 100 [GeV] 0.08 70 < p T < 100 [GeV]
gluon jet gluon jet gluon jet
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-]
(d) (e) (f)
0.16 -1 0.14 -1 0.14 -1
s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS
0.14 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.12 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.12
0.12 t t PowhegHerwig FS t t PowhegHerwig FS 0.1 t t PowhegHerwig FS
0.1
0.1 | η | < 0.8 0.8 < | η | < 1.3 1.3 < | η | < 2.5
Arbitrary units Arbitrary units 0.08 Arbitrary units 0.08
0.08 100 < p T < 150 [GeV] 100 < p T < 150 [GeV] 100 < p T < 150 [GeV]
0.06 b-jet 0.06 b-jet 0.06 b-jet
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-]
(g) (h) (i)
0.18
0.18 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.16 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.16
0.16 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.14 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.14 t t PowhegHerwig FS 0.14 t t PowhegHerwig FS 0.12 t t PowhegHerwig FS
0.12 0.12 0.1
Arbitrary units 0.1 | 100 < p η | < 0.8 < 150 [GeV] Arbitrary units 0.1 0.8 < | 100 < p η | < 1.3 < 150 [GeV] Arbitrary units 1.3 < | 100 < p η | < 2.5 < 150 [GeV]
0.08
0.08 c-jet T 0.08 c-jet T c-jet T
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-]
(j) (k) (l)
0.2 0.18
0.18 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.16 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.16 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.16 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.14 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.14 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.14 t t PowhegHerwig FS 0.12 t t PowhegHerwig FS 0.12 t t PowhegHerwig FS
0.12 0.1
| η | < 0.8 0.1 0.8 < | η | < 1.3 1.3 < | η | < 2.5
Arbitrary units 0.1 100 < p < 150 [GeV] Arbitrary units 100 < p < 150 [GeV] Arbitrary units 0.08 100 < p < 150 [GeV]
T T T
0.08 light jet 0.08 light jet light jet
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
light jet reco p T /truth p T [-] light jet reco p T /truth p T [-] light jet reco p T /truth p T [-]
(m) (n) (o)
Figure A.5: The Run 2 simulated jet response distribution for jets from different p T bins
and | η | bins. The distributions are shown for different t t ¯ samples. The red line represents the
Gaussian fit to the response distribution of the nominal t t ¯ sample. The bottom panel shows
the ratios of jet response distributions in the alternative samples over the jet response in the
nominal t t ¯ sample.


<!-- Page 62 -->

62 Appendix A. Run 2 response distributions
0.2 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.18 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.18 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.18 anti-k R = 0.4 (PFlow+JES) 0.16 anti-k R = 0.4 (PFlow+JES) 0.16 anti-k R = 0.4 (PFlow+JES)
t t PowhegPythia8 AF t t PowhegPythia8 AF t t PowhegPythia8 AF
0.16 t 0.14 t 0.14 t
0.14 t t PowhegHerwig FS 0.12 t t PowhegHerwig FS 0.12 t t PowhegHerwig FS
Arbitrary units 0.12 | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 0.1 1.3 < | η | < 2.5
0.1 100 < p T < 150 [GeV] 0.1 100 < p T < 150 [GeV] 100 < p T < 150 [GeV]
0.08 gluon jet 0.08 gluon jet 0.08 gluon jet
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-]
(a) (b) (c)
0.18 0.16 0.16
-1 -1 -1
0.16 s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS 0.14 s = 13 TeV, 140 fb t t PowhegPythia8 FS
0.14
0.14 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.12 0.12
0.12 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.1
Arbitrary units 0.1 | η | < 0.8 Arbitrary units 0.1 0.8 < | η | < 1.3 Arbitrary units 1.3 < | η | < 2.5
0.08 150 < p T < 200 [GeV] 0.08 150 < p T < 200 [GeV] 0.08 150 < p T < 200 [GeV]
b-jet b-jet b-jet
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-]
(d) (e) (f)
0.22 0.2 0.2
0.2 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.18 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.18 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.18 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.16 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.16 t t PowhegHerwig FS 0.16 t t PowhegHerwig FS 0.14 t t PowhegHerwig FS
0.14 0.14 0.12
Arbitrary units 0.12 | η | < 0.8 Arbitrary units 0.12 0.8 < | η | < 1.3 Arbitrary units 0.1 1.3 < | η | < 2.5
0.1 150 < p T < 200 [GeV] 0.1 150 < p T < 200 [GeV] 150 < p T < 200 [GeV]
0.08 c-jet 0.08 c-jet 0.08 c-jet
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-]
(g) (h) (i)
0.22 0.2 0.2
0.2 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.18 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.18 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.18 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.16 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.16 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.16 t t PowhegHerwig FS 0.14 t t PowhegHerwig FS 0.14 t t PowhegHerwig FS
0.14 0.12
Arbitrary units 0.12 | η | < 0.8 Arbitrary units 0.12 0.8 < | η | < 1.3 Arbitrary units 1.3 < | η | < 2.5
0.1 150 < p T < 200 [GeV] 0.1 150 < p T < 200 [GeV] 0.1 150 < p T < 200 [GeV]
0.08 light jet 0.08 light jet 0.08 light jet
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
light jet reco p T /truth p T [-] light jet reco p T /truth p T [-] light jet reco p T /truth p T [-]
(j) (k) (l)
0.24 0.22 0.22
0.22 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.2 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.2 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.2 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.18 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.18 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.18 0.16 0.16
0.16 t t PowhegHerwig FS 0.14 t t PowhegHerwig FS 0.14 t t PowhegHerwig FS
Arbitrary units 0.14 | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 0.12 1.3 < | η | < 2.5
0.12 150 < p < 200 [GeV] 0.12 150 < p < 200 [GeV] 150 < p < 200 [GeV]
0.1 gluon jet T 0.1 gluon jet T 0.1 gluon jet T
0.08 0.08 0.08
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-]
(m) (n) (o)
Figure A.6: The Run 2 simulated jet response distribution for jets from different p T bins
and | η | bins. The distributions are shown for different t t ¯ samples. The red line represents the
Gaussian fit to the response distribution of the nominal t t ¯ sample. The bottom panel shows
the ratios of jet response distributions in the alternative samples over the jet response in the
nominal t t ¯ sample.


<!-- Page 63 -->

Appendix A. Run 2 response distributions 63
0.2 0.18
0.18
0.18 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.16 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.16
0.16 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.14 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.14 t t PowhegHerwig FS 0.14 t t PowhegHerwig FS 0.12 t t PowhegHerwig FS
0.12 0.12
| η | < 0.8 0.8 < | η | < 1.3 0.1 1.3 < | η | < 2.5
Arbitrary units 0.1 p > 200 [GeV] Arbitrary units 0.1 p > 200 [GeV] Arbitrary units p > 200 [GeV]
0.08 b-jet T 0.08 b-jet T 0.08 b-jet T
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-] 1 b-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-] b-jet reco p T /truth p T [-]
(a) (b) (c)
0.24 0.22
0.22 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.2 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.2 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
0.2 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.18 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.18 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.18 0.16 0.16
0.16 t t PowhegHerwig FS 0.14 t t PowhegHerwig FS 0.14 t t PowhegHerwig FS
Arbitrary units 0.14 | η | < 0.8 Arbitrary units 0.12 0.8 < | η | < 1.3 Arbitrary units 0.12 1.3 < | η | < 2.5
0.12 p > 200 [GeV] p > 200 [GeV] 0.1 p > 200 [GeV]
0.1 c-jet T 0.1 c-jet T 0.08 c-jet T
0.08 0.08
0.06 0.06 0.06
0.04 0.04 0.04
0.02 0.02 0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-] 1 c-jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-] c-jet reco p T /truth p T [-]
(d) (e) (f)
0.25 0.24
0.25 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS 0.22 s = 13 TeV, 140 fb -1 t t PowhegPythia8 FS
anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.2 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.2 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.2 t t PowhegHerwig FS t t PowhegHerwig FS 0.18 t t PowhegHerwig FS
0.16
0.15
Arbitrary units 0.15 | η | < 0.8 Arbitrary units 0.8 < | η | < 1.3 Arbitrary units 0.14 1.3 < | η | < 2.5
p T > 200 [GeV] p T > 200 [GeV] 0.12 p T > 200 [GeV]
0.1 light jet 0.1 light jet 0.08 0.1 light jet
0.06
0.05 0.05 0.04
0.02
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-] 1 light jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
light jet reco p T /truth p T [-] light jet reco p T /truth p T [-] light jet reco p T /truth p T [-]
(g) (h) (i)
-1 0.25 -1 0.25 -1
0.25 s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS s = 13 TeV, 140 fb t t PowhegPythia8 FS
anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF 0.2 anti-k t R = 0.4 (PFlow+JES) t t PowhegPythia8 AF
0.2
0.2 t t PowhegHerwig FS t t PowhegHerwig FS t t PowhegHerwig FS
0.15
Arbitrary units 0.15 | p η | < 0.8 > 200 [GeV] Arbitrary units 0.15 0.8 < | p > 200 [GeV] η | < 1.3 Arbitrary units 1.3 < | p > 200 [GeV] η | < 2.5
T T T
gluon jet gluon jet gluon jet
0.1 0.1 0.1
0.05 0.05 0.05
1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2 1.2 0.6 0.8 1 1.2 1.4 1.6 1.8 2
1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-] 1 gluon jet reco p T /truth p T [-]
0.8 0.8 0.8
Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2 Ratio w.r.t. nominal 0.6 0.8 1 1.2 1.4 1.6 1.8 2
gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-] gluon jet reco p T /truth p T [-]
(j) (k) (l)
Figure A.7: The Run 2 simulated jet response distribution for jets from different p T bins
and | η | bins. The distributions are shown for different t t ¯ samples. The red line represents the
Gaussian fit to the response distribution of the nominal t t ¯ sample. The bottom panel shows
the ratios of jet response distributions in the alternative samples over the jet response in the
nominal t t ¯ sample.


<!-- Page 65 -->


### Appendix B


## Run 2 Data/MC control plots


### B.1 Data/MC control plots without in situ

× 10 3
10 9 Data Data
s = 13 TeV, 140 fb -1 s = 13 TeV, 140 fb -1
10 8 t SingleTop t 250 t SingleTop t
anti-k R = 0.4 (PFlow+JES) anti-k R = 0.4 (PFlow+JES)
10 7 t W+jets Z+jets t W+jets Z+jets
200
10 6 Diboson Fake leptons Diboson Fake leptons
Events / 0.20
Events / 5 GeV 10 5 Uncertainty 150 Uncertainty
10 4
10 3 100
10 2
50
10
1.2 0 50 100 150 200 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 50 100 150 200 Data/Pred. − 2 − 1 0 1 2
Third jet p [GeV] Third jet η [-]
T
(a) (b)
× 10 3
10 9 -1 Data 250 -1 Data
s = 13 TeV, 140 fb t t s = 13 TeV, 140 fb t t
10 8 SingleTop SingleTop
anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES) W+jets
10 7 Z+jets 200 Z+jets
Diboson Diboson
10 6 Fake leptons Fake leptons
Events / 0.20
Events / 5 GeV 10 5 Uncertainty 150 Uncertainty
10 4
100
10 3
10 2
50
10
1.2 0 50 100 150 200 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 50 100 150 200 Data/Pred. − 2 − 1 0 1 2
Fourth jet p [GeV] Fourth jet η [-]
T
(c) (d)
Figure B.1: The Run 2 data (without JES in situ correction) to prediction comparisons in
the Inclusive region with no p T or η cut on the jets from W boson. The uncertainty represents
all considered systematic uncertainties as described in Section ?? .


<!-- Page 66 -->

66 Appendix B. Run 2 Data/MC control plots
3
10 9 × 10
-1 Data 300 -1 Data
10 8 s = 13 TeV, 140 fb t t s = 13 TeV, 140 fb t t
SingleTop SingleTop
10 7 anti-k t R = 0.4 (PFlow+JES) W+jets 250 anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets Z+jets
10 6 Diboson Diboson
Fake leptons 200 Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 0.20 Uncertainty
10 4 150
10 3 100
10 2
50
10
1.2 0 100 200 300 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 100 200 300 Data/Pred. − 2 − 1 0 1 2
Leading b-jet p [GeV] Leading b-jet η [-]
T
(a) (b)
× 10 3
10 9 Data Data
s = 13 TeV, 140 fb -1 s = 13 TeV, 140 fb -1
10 8 t SingleTop t 250 t SingleTop t
anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES) W+jets
10 7 Z+jets Z+jets
10 6 Diboson Fake leptons 200 Diboson Fake leptons
Events / 0.20
Events / 5 GeV 10 5 Uncertainty 150 Uncertainty
10 4
10 3 100
10 2
50
10
1.2 0 50 100 150 200 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 50 100 150 200 Data/Pred. − 2 − 1 0 1 2
Second b-jet p [GeV] Second b-jet η [-]
T
(c) (d)
× 10 3
10 9
-1 Data 140 -1 Data
10 8 s = 13 TeV, 140 fb t t s = 13 TeV, 140 fb t t
SingleTop SingleTop
anti-k R = 0.4 (PFlow+JES) 120 anti-k R = 0.4 (PFlow+JES)
10 7 t W+jets t W+jets
Z+jets Z+jets
10 6 Diboson 100 Diboson
Fake leptons Events / 0.20 Fake leptons
Events / 5 GeV 10 5 Uncertainty 80 Uncertainty
10 4
60
10 3
40
10 2
10 20
1.2 0 50 100 150 200 250 1.2 − 4 − 2 0 2 4
1 E miss T [GeV] 1 phi
0.8 0.8
Data/Pred. 0 50 100 150 200 250 Data/Pred. − 4 − 2 0 2 4
miss miss
E T [GeV] E T φ [-]
(e) (f)
Figure B.2: The Run 2 data (without JES in situ correction) to prediction comparisons in
the Inclusive region with no p T or η cut on the jets from W boson. The uncertainty represents
all considered systematic uncertainties as described in Section ?? .


<!-- Page 67 -->

B.1. Data/MC control plots without in situ 67
10 9
Data Data
10 8 s = 13 TeV, 140 fb -1 t t 10 8 s = 13 TeV, 140 fb -1 t t
SingleTop SingleTop
10 7 anti-k t R = 0.4 (PFlow+JES) W+jets 10 7 anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets Z+jets
10 6 Diboson 10 6 Diboson
Fake leptons Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 5 GeV 10 5 Uncertainty
10 4 10 4
10 3 10 3
10 2 10 2
10 10
1.2 0 50 100 150 200 250 1.2 0 50 100 150 200 250
1 E miss T [GeV] 1 E miss T [GeV]
0.8 0.8
Data/Pred. 0 50 100 150 200 250 Data/Pred. 0 50 100 150 200 250
miss miss
muon event E T [GeV] electron event E T [GeV]
(a) (b)
× 10 3 × 10 3
-1 Data 4000 -1 Data
1400 s = 13 TeV, 140 fb t t s = 13 TeV, 140 fb t t
SingleTop SingleTop
anti-k R = 0.4 (PFlow+JES) 3500 anti-k R = 0.4 (PFlow+JES)
1200 t W+jets Z+jets t W+jets Z+jets
Events / 1 Diboson Events / 1 3000 Diboson
1000 Fake leptons Fake leptons
Uncertainty 2500 Uncertainty
800
2000
600 1500
400 1000
200 500
1.2 0 5 10 1.2 0 1 2 3 4
1 jet n 1 b-jet n
0.8 0.8
Data/Pred. 0 5 10 Data/Pred. 0 1 2 3 4
Jet multiplicity [-] b-jet multiplicity [-]
(c) (d)
Figure B.3: The Run 2 data (without JES in situ correction) to prediction comparisons in
the Inclusive region with no p T or η cut on the jets from W boson. The uncertainty represents
all considered systematic uncertainties as described in Section ?? .


<!-- Page 69 -->


### Appendix C


## Run 3 Data/MC control plots


### C.1 Data/MC control plots without in situ

10 8 -1 Data 60000 -1 Data
s = 13.6 TeV, 52 fb t t s = 13.6 TeV, 52 fb t t
10 7 anti-k R = 0.4 (PFlow+JES) SingleTop anti-k R = 0.4 (PFlow+JES) SingleTop
t W+jets 50000 t W+jets
10 6 Z+jets Diboson Z+jets Diboson
10 5 Fake leptons Uncertainty Events / 0.20 40000 Fake leptons Uncertainty
Events / 5 GeV
10 4 30000
10 3
20000
10 2
10000
10
1.2 0 100 200 300 1.2 − 2 0 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 100 200 300 Data/Pred. − 2 0 2
Electron p [GeV] Electron η [-]
T
(a) (b)
10 8 -1 Data 60000 -1 Data
s = 13.6 TeV, 52 fb t t s = 13.6 TeV, 52 fb t t
10 7 anti-k R = 0.4 (PFlow+JES) SingleTop anti-k R = 0.4 (PFlow+JES) SingleTop
t W+jets 50000 t W+jets
10 6 Z+jets Diboson Z+jets Diboson
10 5 Fake leptons Uncertainty Events / 0.20 40000 Fake leptons Uncertainty
Events / 5 GeV
10 4 30000
10 3
20000
10 2
10000
10
1.2 0 100 200 300 1.2 − 2 0 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 100 200 300 Data/Pred. − 2 0 2
Electron p [GeV] Electron η [-]
T
(c) (d)
Figure C.1: The Run 3 data (without JES in situ correction) to prediction comparisons in
the Inclusive region with no p T or η cut on the jets from W boson. The uncertainty represents
all considered systematic uncertainties as described in Section ?? .


<!-- Page 70 -->

70 Appendix C. Run 3 Data/MC control plots
10 8 -1 Data 50000 -1 Data
s = 13.6 TeV, 52 fb t t s = 13.6 TeV, 52 fb t t
10 7 anti-k R = 0.4 (PFlow+JES) SingleTop anti-k R = 0.4 (PFlow+JES) SingleTop
t W+jets 40000 t W+jets
10 6 Z+jets Diboson Z+jets Diboson
10 5 Fake leptons Uncertainty Events / 0.20 30000 Fake leptons Uncertainty
Events / 5 GeV
10 4
10 3 20000
10 2
10000
10
1.2 0 100 200 300 1.2 − 2 0 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 100 200 300 Data/Pred. − 2 0 2
Muon p [GeV] Muon η [-]
T
(a) (b)
× 10 3
10 8 -1 Data -1 Data
s = 13.6 TeV, 52 fb t t 100 s = 13.6 TeV, 52 fb t t
10 7 anti-k t R = 0.4 (PFlow+JES) SingleTop W+jets anti-k t R = 0.4 (PFlow+JES) SingleTop W+jets
10 6 Z+jets Diboson 80 Z+jets Diboson
10 5 Fake leptons Uncertainty Events / 0.20 Fake leptons Uncertainty
Events / 5 GeV 60
10 4
10 3 40
10 2
20
10
1.2 0 100 200 300 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 100 200 300 Data/Pred. − 2 − 1 0 1 2
Leading jet p [GeV] Leading jet η [-]
T
(c) (d)
× 10 3
10 8 s = 13.6 TeV, 52 fb -1 Data t t 100 s = 13.6 TeV, 52 fb -1 Data t t
SingleTop SingleTop
10 7 anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets Z+jets
10 6 Diboson 80 Diboson
Fake leptons Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 0.20 Uncertainty
60
10 4
10 3 40
10 2
20
10
1.2 0 50 100 150 200 250 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 50 100 150 200 250 Data/Pred. − 2 − 1 0 1 2
Second jet p [GeV] Second jet η [-]
T
(e) (f)
3
10 9 × 10
Data Data
10 8 s = 13.6 TeV, 52 fb -1 t t 100 s = 13.6 TeV, 52 fb -1 t t
SingleTop SingleTop
10 7 anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets 80 Z+jets
10 6 Diboson Diboson
Fake leptons Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 0.20 60 Uncertainty
10 4
10 3 40
10 2
20
10
1.2 0 50 100 150 200 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 50 100 150 200 Data/Pred. − 2 − 1 0 1 2
Third jet p [GeV] Third jet η [-]
T
(g) (h)
Figure C.2: The Run 3 data (without JES in situ correction) to prediction comparisons in
the Inclusive region with no p T or η cut on the jets from W boson. The uncertainty represents
all considered systematic uncertainties as described in Section ?? .


<!-- Page 71 -->

C.1. Data/MC control plots without in situ 71
3
10 9 100 × 10
-1 Data -1 Data
10 8 s = 13.6 TeV, 52 fb t t s = 13.6 TeV, 52 fb t t
SingleTop SingleTop
10 7 anti-k t R = 0.4 (PFlow+JES) W+jets 80 anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets Z+jets
10 6 Diboson Diboson
Fake leptons Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 0.20 60 Uncertainty
10 4
40
10 3
10 2
20
10
1.2 0 50 100 150 200 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 50 100 150 200 Data/Pred. − 2 − 1 0 1 2
Fourth jet p [GeV] Fourth jet η [-]
T
(i) (j)
× 10 3
10 8 s = 13.6 TeV, 52 fb -1 Data s = 13.6 TeV, 52 fb -1 Data
t t t t
10 7 anti-k t R = 0.4 (PFlow+JES) SingleTop W+jets 100 anti-k t R = 0.4 (PFlow+JES) SingleTop W+jets
10 6 Z+jets Diboson 80 Z+jets Diboson
10 5 Fake leptons Uncertainty Events / 0.20 Fake leptons Uncertainty
Events / 5 GeV
60
10 4
10 3 40
10 2
20
10
1.2 0 100 200 300 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 100 200 300 Data/Pred. − 2 − 1 0 1 2
Leading b-jet p [GeV] Leading b-jet η [-]
T
(k) (l)
3
10 9 × 10
Data Data
10 8 s = 13.6 TeV, 52 fb -1 t t 100 s = 13.6 TeV, 52 fb -1 t t
SingleTop SingleTop
10 7 anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets 80 Z+jets
10 6 Diboson Diboson
Fake leptons Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 0.20 60 Uncertainty
10 4
10 3 40
10 2
20
10
1.2 0 50 100 150 200 1.2 − 2 − 1 0 1 2
1 p T [GeV] 1 eta
0.8 0.8
Data/Pred. 0 50 100 150 200 Data/Pred. − 2 − 1 0 1 2
Second b-jet p [GeV] Second b-jet η [-]
T
(m) (n)
10 8 s = 13.6 TeV, 52 fb -1 Data t t 50000 s = 13.6 TeV, 52 fb -1 Data t t
10 7 anti-k t R = 0.4 (PFlow+JES) SingleTop W+jets anti-k t R = 0.4 (PFlow+JES) SingleTop W+jets
10 6 Z+jets Diboson 40000 Z+jets Diboson
Fake leptons Fake leptons
Events / 5 GeV 10 5 Uncertainty Events / 0.20 Uncertainty
30000
10 4
10 3 20000
10 2
10000
10
1.2 0 50 100 150 200 250 1.2 − 4 − 2 0 2 4
1 E miss T [GeV] 1 phi
0.8 0.8
Data/Pred. 0 50 100 150 200 250 Data/Pred. − 4 − 2 0 2 4
miss miss
E T [GeV] E T φ [-]
(o) (p)
Figure C.2: The Run 3 data (without JES in situ correction) to prediction comparisons in
the Inclusive region with no p T or η cut on the jets from W boson. The uncertainty represents
all considered systematic uncertainties as described in Section ?? .


<!-- Page 72 -->

72 Appendix C. Run 3 Data/MC control plots
10 8 -1 Data 10 8 -1 Data
s = 13.6 TeV, 52 fb t t s = 13.6 TeV, 52 fb t t
10 7 anti-k R = 0.4 (PFlow+JES) SingleTop 10 7 anti-k R = 0.4 (PFlow+JES) SingleTop
t W+jets t W+jets
10 6 Z+jets 10 6 Z+jets
Diboson Diboson
10 5 Fake leptons Uncertainty 10 5 Fake leptons Uncertainty
Events / 5 GeV Events / 5 GeV
10 4 10 4
10 3 10 3
10 2 10 2
10 10
1.2 0 50 100 150 200 250 1.2 0 50 100 150 200 250
1 E miss T [GeV] 1 E miss T [GeV]
0.8 0.8
Data/Pred. 0 50 100 150 200 250 Data/Pred. 0 50 100 150 200 250
miss miss
muon event E T [GeV] electron event E T [GeV]
(a) (b)
× 10 3 × 10 3
s = 13.6 TeV, 52 fb -1 Data s = 13.6 TeV, 52 fb -1 Data
t t 1400 t t
500 SingleTop SingleTop
anti-k t R = 0.4 (PFlow+JES) W+jets anti-k t R = 0.4 (PFlow+JES) W+jets
Z+jets 1200 Z+jets
Events / 1 400 Diboson Events / 1 Diboson
Fake leptons 1000 Fake leptons
Uncertainty Uncertainty
300 800
600
200
400
100
200
1.2 0 5 10 1.2 0 1 2 3 4
1 jet n 1 b-jet n
0.8 0.8
Data/Pred. 0 5 10 Data/Pred. 0 1 2 3 4
Jet multiplicity [-] b-jet multiplicity [-]
(c) (d)
Figure C.3: The Run 3 data (without JES in situ correction) to prediction comparisons in
the Inclusive region with no p T or η cut on the jets from W boson. The uncertainty represents
all considered systematic uncertainties as described in Section ?? .


<!-- Page 73 -->


### Appendix D


## Run 2 W -mass templates

2000 -1 3500 ATLAS Simulation
s = 13 TeV, 140 fb JES JES
1800 s = 0.95 3000 s = 13 TeV, 140 fb -1 s = 0.95
anti-k R = 0.4 (PFlow+JES)
1600 reco t s = 0.98 anti-k t R = 0.4 (PFlow+JES) s = 0.98
1400 jets p T ∈ [20,35] GeV s = 1.00 2500 jets p reco T ∈ [35,50] GeV s = 1.00
Events / 3 GeV | η | < 0.8 Events / 2 GeV
1200 jet s = 1.02 2000 | η jet | < 0.8 s = 1.02
1000 s = 1.05 s = 1.05
800 1500
600 1000
400
200 500
50 60 70 80 1.4 60 80 100
W mass [GeV] 1.2 W mass [GeV]
1
Variation w.r.t. s = 1 Variation w.r.t. s = 1 1
0.8 0.8
50 60 70 80 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b)
2000 ATLAS Simulation 1600 ATLAS Simulation
1800 s = 13 TeV, 140 fb -1 JES s = 13 TeV, 140 fb -1 JES
s = 0.95 1400 s = 0.95
1600 anti-k t R = 0.4 (PFlow+JES) s = 0.98 anti-k t R = 0.4 (PFlow+JES) s = 0.98
1400 jets p reco T ∈ [50,70] GeV s = 1.00 1200 jets p reco T ∈ [70,100] GeV s = 1.00
Events / 2 GeV 1200 | η jet | < 0.8 s = 1.02 Events / 2 GeV 1000 | η jet | < 0.8 s = 1.02
1000 s = 1.05 800 s = 1.05
800 600
600
400 400
200 200
60 80 100 2 60 80 100
1.5
W mass [GeV] W mass [GeV]
1.5
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.5
60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(c) (d)
Figure D.1: Template W -boson mass distributions for various corrections s or r , to JES
or JER, respectively. Run 2 templates in the different diagonal regions are shown. For JES
variations, the JER correction, r , is set to one, and vice versa.


<!-- Page 74 -->

74 Appendix D. Run 2 W -mass templates
2000 ATLAS Simulation 60 ATLAS Simulation
1800 s = 13 TeV, 140 fb -1 JES s = 13 TeV, 140 fb -1 JES
s = 0.95 s = 0.95
1600 anti-k t R = 0.4 (PFlow+JES) s = 0.98 50 anti-k t R = 0.4 (PFlow+JES) s = 0.98
1400 jets p reco T ∈ [100,150] GeV s = 1.00 40 jets p reco T ∈ [150,200] GeV s = 1.00
Events / 3 GeV Events / 2 GeV
1200 | η jet | < 0.8 s = 1.02 | η jet | < 0.8 s = 1.02
1000 s = 1.05 30 s = 1.05
800
600 20
400 10
200
60 80 100 70 80 90 100 110
2 W mass [GeV] 3 W mass [GeV]
1.5 2
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.5
60 80 100 0 70 80 90 100 110
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(e) (f)
4500
1800 s = 13 TeV, 140 fb -1 JER 4000 ATLAS Simulation JER
-1
1600 anti-k t R = 0.4 (PFlow+JES) r = 0.60 3500 s = 13 TeV, 140 fb r = 0.60
1400 jets p reco ∈ [20,35] GeV r = 0.84 3000 anti-k reco t R = 0.4 (PFlow+JES) r = 0.84
T jets p ∈ [35,50] GeV
Events / 3 GeV 1200 | η jet | < 0.8 r = 1.00 Events / 2 GeV | η | < 0.8 T r = 1.00
r = 1.16 2500 r = 1.16
1000 r = 1.40 jet r = 1.40
2000
800
600 1500
400 1000
200 500
50 60 70 80 1.4 60 80 100
W mass [GeV] 1.2 W mass [GeV]
1
Variation w.r.t. r = 1 Variation w.r.t. r = 1 1
0.8 0.8
50 60 70 80 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(g) (h)
2200
2500 ATLAS Simulation 2000 ATLAS Simulation
s = 13 TeV, 140 fb -1 JER 1800 s = 13 TeV, 140 fb -1 JER
r = 0.60 r = 0.60
2000 anti-k t R = 0.4 (PFlow+JES) r = 0.84 1600 anti-k t R = 0.4 (PFlow+JES) r = 0.84
jets p reco ∈ [50,70] GeV jets p reco ∈ [70,100] GeV
Events / 2 GeV T r = 1.00 Events / 2 GeV 1400 T r = 1.00
1500 | η jet | < 0.8 r = 1.16 1200 | η jet | < 0.8 r = 1.16
r = 1.40 1000 r = 1.40
1000 800
600
500 400
200
60 80 100 1.5 60 80 100
1.4
1.2 W mass [GeV] W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8
60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(i) (j)
2200 ATLAS Simulation 35 -1
2000 s = 13 TeV, 140 fb -1 JER 30 s = 13 TeV, 140 fb JER
1800 anti-k R = 0.4 (PFlow+JES) r = 0.60 anti-k t R = 0.4 (PFlow+JES) r = 0.60
1600 jets p reco t ∈ [100,150] GeV r = 0.84 25 jets p reco T ∈ [150,200] GeV r = 0.84
Events / 3 GeV 1400 | η | < 0.8 T r = 1.00 Events / 2 GeV | η jet | < 0.8 r = 1.00
1200 jet r = 1.16 20 r = 1.16
1000 r = 1.40 15 r = 1.40
800
600 10
400 5
200
1.494 60 80 100 2 70 80 90 100 110
1.2648 W mass [GeV] W mass [GeV]
1.0356 1
Variation w.r.t. r = 1 Variation w.r.t. r = 1
0.8064
0.5772 60 80 100 0 70 80 90 100 110
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(k) (l)
Figure D.1: Template W -boson mass distributions for various corrections s or r , to JES
or JER, respectively. Run 2 templates in the different diagonal regions are shown. For JES
variations, the JER correction, r , is set to one, and vice versa.


<!-- Page 75 -->

Appendix D. Run 2 W -mass templates 75
450 -1 450 -1 800 -1
400 s = 13 TeV, 140 fb s JES = 0.95 400 s = 13 TeV, 140 fb s JES = 0.95 s = 13 TeV, 140 fb s JES = 0.95
700
350 anti-k reco t R = 0.4 (PFlow+JES) s 1 1 = 0.98 350 anti-k reco t R = 0.4 (PFlow+JES) s 2 2 = 0.98 anti-k reco t R = 0.4 (PFlow+JES) s 1 1 = 0.98
Events / 1 GeV 300 jet jet 2 p p reco T ∈ ∈ [150,200] GeV [100,150] GeV s 1 = 1.00 Events / 1 GeV 300 jet jet 2 p p reco T ∈ ∈ [150,200] GeV [100,150] GeV s 2 = 1.00 Events / 2 GeV 600 jet jet 2 p p reco T ∈ ∈ [150,200] GeV [70,100] GeV s 1 = 1.00
250 | η jet 1 | < 0.8 T s 1 = 1.02 250 | η jet 1 | < 0.8 T s 2 = 1.02 500 | η jet 1 | < 0.8 T s 1 = 1.02
200 s 1 = 1.05 200 s 2 = 1.05 400 s 1 = 1.05
150 150 300
100 100 200
50 50 100
2 60 70 80 90 100 110 60 70 80 90 100 110 60 80 100
W mass [GeV] 1.5 W mass [GeV] 1.5 W mass [GeV]
1.5
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
60 70 80 90 100 110 60 70 80 90 100 110 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b) (c)
800 -1 800 -1 700 -1
700 s = 13 TeV, 140 fb s JES = 0.95 700 s = 13 TeV, 140 fb s JES = 0.95 600 s = 13 TeV, 140 fb s JES = 0.95
anti-k R = 0.4 (PFlow+JES) 2 anti-k R = 0.4 (PFlow+JES) 1 anti-k R = 0.4 (PFlow+JES) 2
600 jet p reco t ∈ [70,100] GeV s 2 = 0.98 600 jet p reco t ∈ [50,70] GeV s 1 = 0.98 500 jet p reco t ∈ [50,70] GeV s 2 = 0.98
Events / 2 GeV 500 jet 2 1 p reco T T ∈ [150,200] GeV s 2 = 1.00 Events / 2 GeV 500 jet 2 1 p reco T T ∈ [150,200] GeV s 1 = 1.00 Events / 2 GeV jet 2 1 p reco T T ∈ [150,200] GeV s 2 = 1.00
s = 1.02 s = 1.02 400 s = 1.02
400 | η jet | < 0.8 s 2 2 = 1.05 400 | η jet | < 0.8 s 1 1 = 1.05 | η jet | < 0.8 s 2 2 = 1.05
300 300 300
200 200 200
100 100 100
1.5 60 80 100 60 80 100 1.4687 60 80 100
W mass [GeV] 1.5 W mass [GeV] 1.2643 W mass [GeV]
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1 Variation 1.0598 w.r.t. s = 1
0.8554
60 80 100 60 80 100 0.6509 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(d) (e) (f)
700 600
-1 -1 -1
600 s = 13 TeV, 140 fb s JES = 0.95 s = 13 TeV, 140 fb s JES = 0.95 700 s = 13 TeV, 140 fb s JES = 0.95
anti-k t R = 0.4 (PFlow+JES) 1 500 anti-k t R = 0.4 (PFlow+JES) 2 anti-k t R = 0.4 (PFlow+JES) 1
500 jet p reco ∈ [35,50] GeV s 1 = 0.98 jet p reco ∈ [35,50] GeV s 2 = 0.98 600 jet p reco ∈ [20,35] GeV s 1 = 0.98
2 reco T s = 1.00 400 2 reco T s = 1.00 500 2 reco T s = 1.00
Events / 2 GeV 400 jet | η 1 | < 0.8 p T ∈ [150,200] GeV s 1 1 = 1.02 Events / 2 GeV jet | η 1 | < 0.8 p T ∈ [150,200] GeV s 2 2 = 1.02 Events / 2 GeV jet | η 1 | < 0.8 p T ∈ [150,200] GeV s 1 1 = 1.02
jet jet 400 jet
300 s 1 = 1.05 300 s 2 = 1.05 300 s 1 = 1.05
200 200 200
100 100 100
60 80 100 60 80 100 1.5 60 80 100
1.5 W mass [GeV] 1.2 W mass [GeV] W mass [GeV]
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(g) (h) (i)
700 2400 2400
-1 2200 -1 -1
600 s = 13 TeV, 140 fb s JES = 0.95 2000 s = 13 TeV, 140 fb s JES = 0.95 2000 2200 s = 13 TeV, 140 fb s JES = 0.95
anti-k t R = 0.4 (PFlow+JES) 2 anti-k t R = 0.4 (PFlow+JES) 1 anti-k t R = 0.4 (PFlow+JES) 2
500 jet p reco ∈ [20,35] GeV s 2 = 0.98 1600 1800 jet p reco ∈ [70,100] GeV s 1 = 0.98 1800 jet p reco ∈ [70,100] GeV s 2 = 0.98
2 reco T s 2 = 1.00 2 reco T s 1 = 1.00 1600 2 reco T s 2 = 1.00
Events / 2 GeV 400 jet | η 1 | < 0.8 p T ∈ [150,200] GeV s 2 = 1.02 Events / 2 GeV 1400 jet | η 1 | < 0.8 p T ∈ [100,150] GeV s 1 = 1.02 Events / 2 GeV 1400 jet | η 1 | < 0.8 p T ∈ [100,150] GeV s 2 = 1.02
jet 1200 jet 1200 jet
300 s 2 = 1.05 1000 s 1 = 1.05 1000 s 2 = 1.05
200 600 800 600 800
100 400 400
200 200
60 80 100 60 80 100 1.5 60 80 100
1.2 1.5
W mass [GeV] W mass [GeV] W mass [GeV]
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(j) (k) (l)
2400
2200 s = 13 TeV, 140 fb -1 JES 2200 s = 13 TeV, 140 fb -1 JES 2200 s = 13 TeV, 140 fb -1 JES
2000 anti-k R = 0.4 (PFlow+JES) s = 0.95 2000 anti-k R = 0.4 (PFlow+JES) s = 0.95 2000 anti-k R = 0.4 (PFlow+JES) s = 0.95
1800 reco t s 1 = 0.98 1800 reco t s 2 = 0.98 1800 reco t s 1 = 0.98
1600 jet 2 p reco T ∈ [50,70] GeV s 1 = 1.00 1600 jet 2 p reco T ∈ [50,70] GeV s 2 = 1.00 1600 jet 2 p reco T ∈ [35,50] GeV s 1 = 1.00
Events / 2 GeV 1400 jet 1 p T ∈ [100,150] GeV s 1 = 1.02 Events / 2 GeV 1400 jet 1 p T ∈ [100,150] GeV s 2 = 1.02 Events / 2 GeV 1400 jet 1 p T ∈ [100,150] GeV s 1 = 1.02
1200 | η jet | < 0.8 s 1 = 1.05 1200 | η jet | < 0.8 s 2 = 1.05 1200 | η jet | < 0.8 s 1 = 1.05
1000 1 1000 2 1000 1
800 800 800
600 600 600
400 400 400
200 200 200
1.5 60 80 100 1.4 60 80 100 1.5 60 80 100
W mass [GeV] 1.2 W mass [GeV] W mass [GeV]
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(m) (n) (o)
Figure D.2: Template W -boson mass distributions for various corrections s 1 or s 2 to the
JES of the leading or sub-leading jet from W decay, respectively. Run 2 templates in the
different off-diagonal regions are shown. The JER correction factor, r , is fixed to unity.


<!-- Page 76 -->

76 Appendix D. Run 2 W -mass templates
2200 3000
2000 s = 13 TeV, 140 fb -1 JES s = 13 TeV, 140 fb -1 JES 2500 s = 13 TeV, 140 fb -1 JES
1800 anti-k t R = 0.4 (PFlow+JES) s 2 = 0.95 2500 anti-k t R = 0.4 (PFlow+JES) s 1 = 0.95 anti-k t R = 0.4 (PFlow+JES) s 2 = 0.95
1600 jet p reco ∈ [35,50] GeV s 2 = 0.98 jet p reco ∈ [20,35] GeV s 1 = 0.98 2000 jet p reco ∈ [20,35] GeV s 2 = 0.98
Events / 2 GeV 1400 jet 2 p reco T ∈ [100,150] GeV s 2 = 1.00 Events / 2 GeV 2000 jet 2 p reco T ∈ [100,150] GeV s 1 = 1.00 Events / 2 GeV jet 2 p reco T ∈ [100,150] GeV s 2 = 1.00
1200 | η 1 | < 0.8 T s 2 = 1.02 | η 1 | < 0.8 T s 1 = 1.02 1500 | η 1 | < 0.8 T s 2 = 1.02
1000 jet s 2 = 1.05 1500 jet s 1 = 1.05 jet s 2 = 1.05
800 1000 1000
600
400 500 500
200
60 80 100 1.4 60 80 100 60 80 100
1.2 W mass [GeV] 1.2 W mass [GeV] 1.1 W mass [GeV]
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.9
0.8 0.8
60 80 100 60 80 100 0.8 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b) (c)
3500 3500 3500
-1 -1 -1
3000 s = 13 TeV, 140 fb s JES = 0.95 3000 s = 13 TeV, 140 fb s JES = 0.95 3000 s = 13 TeV, 140 fb s JES = 0.95
anti-k t R = 0.4 (PFlow+JES) 1 anti-k t R = 0.4 (PFlow+JES) 2 anti-k t R = 0.4 (PFlow+JES) 1
2500 jet p reco ∈ [50,70] GeV s 1 = 0.98 2500 jet p reco ∈ [50,70] GeV s 2 = 0.98 2500 jet p reco ∈ [35,50] GeV s 1 = 0.98
2 reco T s = 1.00 2 reco T s = 1.00 2 reco T s = 1.00
Events / 2 GeV 2000 jet 1 p T ∈ [70,100] GeV s 1 1 = 1.02 Events / 2 GeV 2000 jet 1 p T ∈ [70,100] GeV s 2 2 = 1.02 Events / 2 GeV 2000 jet 1 p T ∈ [70,100] GeV s 1 1 = 1.02
| η jet | < 0.8 | η jet | < 0.8 | η jet | < 0.8
1500 s 1 = 1.05 1500 s 2 = 1.05 1500 s 1 = 1.05
1000 1000 1000
500 500 500
1.4912 60 80 100 1.4 60 80 100 60 80 100
1.2784 W mass [GeV] 1.2 W mass [GeV] 1.2 W mass [GeV]
1.0655 1 1
Variation w.r.t. s = 1 Variation w.r.t. s = 1 Variation w.r.t. s = 1
0.8527 0.8 0.8
0.6398 60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(d) (e) (f)
3500 -1 6000 -1 -1
s = 13 TeV, 140 fb JES s = 13 TeV, 140 fb JES s = 13 TeV, 140 fb JES
3000 anti-k t R = 0.4 (PFlow+JES) s 2 = 0.95 5000 anti-k t R = 0.4 (PFlow+JES) s 1 = 0.95 5000 anti-k t R = 0.4 (PFlow+JES) s 2 = 0.95
2500 jet 2 p reco T ∈ [35,50] GeV s s 2 = 0.98 = 1.00 4000 jet 2 p reco T ∈ [20,35] GeV s s 1 = 0.98 = 1.00 4000 jet 2 p reco T ∈ [20,35] GeV s s 2 = 0.98 = 1.00
Events / 2 GeV jet p reco ∈ [70,100] GeV 2 Events / 2 GeV jet p reco ∈ [70,100] GeV 1 Events / 2 GeV jet p reco ∈ [70,100] GeV 2
2000 | η 1 | < 0.8 T s 2 = 1.02 | η 1 | < 0.8 T s 1 = 1.02 3000 | η 1 | < 0.8 T s 2 = 1.02
jet s = 1.05 3000 jet s = 1.05 jet s = 1.05
1500 2 1 2
2000 2000
1000
500 1000 1000
60 80 100 60 80 100 60 80 100
1.2
W mass [GeV] 1.2 W mass [GeV] 1.1 W mass [GeV]
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.9
0.8 0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(g) (h) (i)
4500 -1 4500 -1 -1
4000 s = 13 TeV, 140 fb s JES = 0.95 4000 s = 13 TeV, 140 fb s JES = 0.95 7000 s = 13 TeV, 140 fb s JES = 0.95
3500 anti-k reco t R = 0.4 (PFlow+JES) s 1 1 = 0.98 3500 anti-k reco t R = 0.4 (PFlow+JES) s 2 2 = 0.98 6000 anti-k reco t R = 0.4 (PFlow+JES) s 1 1 = 0.98
Events / 2 GeV 3000 jet jet 2 p p reco T ∈ ∈ [50,70] GeV [35,50] GeV s 1 = 1.00 Events / 2 GeV 3000 jet jet 2 p p reco T ∈ ∈ [50,70] GeV [35,50] GeV s 2 = 1.00 Events / 2 GeV 5000 jet jet 2 p p reco T ∈ ∈ [50,70] GeV [20,35] GeV s 1 = 1.00
2500 | η 1 | < 0.8 T s 1 = 1.02 2500 | η 1 | < 0.8 T s 2 = 1.02 4000 | η 1 | < 0.8 T s 1 = 1.02
jet jet jet
2000 s 1 = 1.05 2000 s 2 = 1.05 3000 s 1 = 1.05
1500 1500
1000 1000 2000
500 500 1000
60 80 100 1.2 60 80 100 60 80 100
1.2 W mass [GeV] W mass [GeV] 1.2 W mass [GeV]
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.8 0.8 0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(j) (k) (l)
8000 4000
-1 -1 -1
7000 s = 13 TeV, 140 fb JES 3500 s = 13 TeV, 140 fb JES 3500 s = 13 TeV, 140 fb JES
anti-k R = 0.4 (PFlow+JES) s = 0.95 anti-k R = 0.4 (PFlow+JES) s = 0.95 anti-k R = 0.4 (PFlow+JES) s = 0.95
6000 reco t s 2 2 = 0.98 3000 reco t s 1 1 = 0.98 3000 reco t s 2 2 = 0.98
jet p ∈ [20,35] GeV jet p ∈ [20,35] GeV jet p ∈ [20,35] GeV
Events / 2 GeV 5000 jet 2 1 p reco T T ∈ [50,70] GeV s 2 = 1.00 Events / 1 GeV 2500 jet 2 1 p reco T T ∈ [35,50] GeV s 1 = 1.00 Events / 1 GeV 2500 jet 2 1 p reco T T ∈ [35,50] GeV s 2 = 1.00
s = 1.02 s = 1.02 s = 1.02
4000 | η jet | < 0.8 s 2 2 = 1.05 2000 | η jet | < 0.8 s 1 1 = 1.05 2000 | η jet | < 0.8 s 2 2 = 1.05
3000 1500 1500
2000 1000 1000
1000 500 500
60 80 100 50 60 70 80 90 100 50 60 70 80 90 100
1.2
1.1 W mass [GeV] W mass [GeV] W mass [GeV]
1 1 1
Variation w.r.t. s = 1 Variation w.r.t. s = 1 Variation w.r.t. s = 1
0.9
0.8 0.8
60 80 100 50 60 70 80 90 100 50 60 70 80 90 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(m) (n) (o)
Figure D.3: Template W -boson mass distributions for various corrections s 1 or s 2 to the
JES of the leading or sub-leading jet from W decay, respectively. Run 2 templates in the
different off-diagonal regions are shown. The JER correction factor, r , is fixed to unity.


<!-- Page 77 -->

Appendix D. Run 2 W -mass templates 77
450 800
400 s = 13 TeV, 140 fb -1 JER 400 s = 13 TeV, 140 fb -1 JER s = 13 TeV, 140 fb -1 JER
350 anti-k t R = 0.4 (PFlow+JES) r 1 = 0.60 350 anti-k t R = 0.4 (PFlow+JES) r 2 = 0.60 700 anti-k t R = 0.4 (PFlow+JES) r 1 = 0.60
300 jet 2 p reco T ∈ [100,150] GeV r r 1 = 0.84 = 1.00 300 jet 2 p reco T ∈ [100,150] GeV r r 2 = 0.84 = 1.00 600 jet 2 p reco T ∈ [70,100] GeV r r 1 = 0.84 = 1.00
reco reco reco
Events / 1 GeV 250 jet 1 p T ∈ [150,200] GeV r 1 1 = 1.16 Events / 1 GeV 250 jet 1 p T ∈ [150,200] GeV r 2 2 = 1.16 Events / 2 GeV 500 jet 1 p T ∈ [150,200] GeV r 1 1 = 1.16
| η | < 0.8 | η | < 0.8 | η | < 0.8
200 jet r 1 = 1.40 200 jet r 2 = 1.40 400 jet r 1 = 1.40
150 150 300
100 100 200
50 50 100
60 70 80 90 100 110 1.4 60 70 80 90 100 110 60 80 100
1.5 W mass [GeV] 1.2 W mass [GeV] 1.2 W mass [GeV]
1
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1 Variation w.r.t. r = 1
0.8 0.8
60 70 80 90 100 110 60 70 80 90 100 110 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b) (c)
900 800
-1 -1 -1
800 s = 13 TeV, 140 fb JER 700 s = 13 TeV, 140 fb JER s = 13 TeV, 140 fb JER
700
700 anti-k reco t R = 0.4 (PFlow+JES) r r 2 = 0.60 = 0.84 600 anti-k reco t R = 0.4 (PFlow+JES) r r 1 = 0.60 = 0.84 anti-k reco t R = 0.4 (PFlow+JES) r r 2 = 0.60 = 0.84
2 1 2
Events / 2 GeV 600 jet jet 2 p p reco T ∈ ∈ [150,200] GeV [70,100] GeV r 2 = 1.00 Events / 2 GeV 500 jet jet 2 p p reco T ∈ ∈ [150,200] GeV [50,70] GeV r 1 = 1.00 Events / 2 GeV 600 jet jet 2 p p reco T ∈ ∈ [150,200] GeV [50,70] GeV r 2 = 1.00
500 | η 1 | < 0.8 T r 2 = 1.16 400 | η 1 | < 0.8 T r 1 = 1.16 500 | η 1 | < 0.8 T r 2 = 1.16
400 jet r 2 = 1.40 300 jet r 1 = 1.40 400 jet r 2 = 1.40
300 300
200 200 200
100 100 100
60 80 100 60 80 100 60 80 100
1.2 W mass [GeV] 1.2 W mass [GeV] 1.2 W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8 0.8
60 80 100 0.8 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(d) (e) (f)
700
600 s = 13 TeV, 140 fb -1 JER 700 s = 13 TeV, 140 fb -1 JER s = 13 TeV, 140 fb -1 JER
600
500 anti-k reco t R = 0.4 (PFlow+JES) r r 1 = 0.60 = 0.84 600 anti-k reco t R = 0.4 (PFlow+JES) r r 2 = 0.60 = 0.84 anti-k reco t R = 0.4 (PFlow+JES) r r 1 = 0.60 = 0.84
jet p ∈ [35,50] GeV 1 500 jet p ∈ [35,50] GeV 2 500 jet p ∈ [20,35] GeV 1
Events / 2 GeV 400 jet 2 1 p reco T T ∈ [150,200] GeV r 1 = 1.00 Events / 2 GeV jet 2 1 p reco T T ∈ [150,200] GeV r 2 = 1.00 Events / 2 GeV jet 2 1 p reco T T ∈ [150,200] GeV r 1 = 1.00
| η | < 0.8 r 1 = 1.16 400 | η | < 0.8 r 2 = 1.16 400 | η | < 0.8 r 1 = 1.16
300 jet r 1 = 1.40 jet r 2 = 1.40 300 jet r 1 = 1.40
300
200 200 200
100 100 100
60 80 100 60 80 100 60 80 100
1.2
1.2 W mass [GeV] 1.2 W mass [GeV] W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(g) (h) (i)
800 s = 13 TeV, 140 fb -1 JER 2500 s = 13 TeV, 140 fb -1 JER 2500 s = 13 TeV, 140 fb -1 JER
700 anti-k t R = 0.4 (PFlow+JES) r 2 = 0.60 2000 anti-k t R = 0.4 (PFlow+JES) r 1 = 0.60 anti-k t R = 0.4 (PFlow+JES) r 2 = 0.60
600 jet 2 p reco T ∈ [20,35] GeV r 2 = 0.84 jet 2 p reco T ∈ [70,100] GeV r 1 = 0.84 2000 jet 2 p reco T ∈ [70,100] GeV r 2 = 0.84
r = 1.00 r = 1.00 r = 1.00
Events / 2 GeV 500 jet 1 p reco T ∈ [150,200] GeV r 2 = 1.16 Events / 2 GeV 1500 jet 1 p reco T ∈ [100,150] GeV r 1 = 1.16 Events / 2 GeV 1500 jet 1 p reco T ∈ [100,150] GeV r 2 = 1.16
2 1 2
400 | η jet | < 0.8 r 2 = 1.40 | η jet | < 0.8 r 1 = 1.40 | η jet | < 0.8 r 2 = 1.40
300 1000 1000
200 500
500
100
60 80 100 60 80 100 60 80 100
1.2 W mass [GeV] 1.2 W mass [GeV] 1.2 W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8 0.8 0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(j) (k) (l)
2400 2200
2200 s = 13 TeV, 140 fb -1 JER 2500 s = 13 TeV, 140 fb -1 JER 2000 s = 13 TeV, 140 fb -1 JER
2000 anti-k R = 0.4 (PFlow+JES) r 1 = 0.60 anti-k R = 0.4 (PFlow+JES) r 2 = 0.60 anti-k R = 0.4 (PFlow+JES) r 1 = 0.60
1800 reco t r = 0.84 2000 reco t r = 0.84 1800 reco t r = 0.84
1600 jet 2 p reco T ∈ [50,70] GeV r 1 = 1.00 jet 2 p reco T ∈ [50,70] GeV r 2 = 1.00 1600 jet 2 p reco T ∈ [35,50] GeV r 1 = 1.00
Events / 2 GeV 1400 jet 1 p T ∈ [100,150] GeV r 1 = 1.16 Events / 2 GeV jet 1 p T ∈ [100,150] GeV r 2 = 1.16 Events / 2 GeV 1400 jet 1 p T ∈ [100,150] GeV r 1 = 1.16
1200 | η jet | < 0.8 r 1 = 1.40 1500 | η jet | < 0.8 r 2 = 1.40 1200 | η jet | < 0.8 r 1 = 1.40
1000 1 2 1000 1
800 1000 800
600 600
400 500 400
200 200
60 80 100 60 80 100 1.2 60 80 100
1.2 W mass [GeV] 1.2 W mass [GeV] W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8 0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(m) (n) (o)
Figure D.4: Template W -boson mass distributions for various corrections r 1 or r 2 to the
JER of the leading or sub-leading jet from W decay, respectively. Run 2 templates in the
different off-diagonal regions are shown. The JES correction factor, s , is fixed to unity.


<!-- Page 78 -->

78 Appendix D. Run 2 W -mass templates
2500 s = 13 TeV, 140 fb -1 JER 2500 s = 13 TeV, 140 fb -1 JER 3000 s = 13 TeV, 140 fb -1 JER
r = 0.60 r = 0.60 r = 0.60
2000 anti-k reco t R = 0.4 (PFlow+JES) r 2 2 = 0.84 2000 anti-k reco t R = 0.4 (PFlow+JES) r 1 1 = 0.84 2500 anti-k reco t R = 0.4 (PFlow+JES) r 2 2 = 0.84
jet p ∈ [35,50] GeV jet p ∈ [20,35] GeV jet p ∈ [20,35] GeV
Events / 2 GeV 2 reco T r 2 = 1.00 Events / 2 GeV 2 reco T r 1 = 1.00 Events / 2 GeV 2 reco T r 2 = 1.00
1500 jet | η 1 | < 0.8 p T ∈ [100,150] GeV r 2 = 1.16 1500 jet | η 1 | < 0.8 p T ∈ [100,150] GeV r 1 = 1.16 2000 jet | η 1 | < 0.8 p T ∈ [100,150] GeV r 2 = 1.16
jet r 2 = 1.40 jet r 1 = 1.40 1500 jet r 2 = 1.40
1000 1000
1000
500 500 500
60 80 100 60 80 100 60 80 100
1.2 W mass [GeV] 1.1 W mass [GeV] 1.2 W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8 0.9 0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b) (c)
3500 s = 13 TeV, 140 fb -1 JER 4000 s = 13 TeV, 140 fb -1 JER 3500 s = 13 TeV, 140 fb -1 JER
3500
3000 anti-k t R = 0.4 (PFlow+JES) r 1 = 0.60 anti-k t R = 0.4 (PFlow+JES) r 2 = 0.60 3000 anti-k t R = 0.4 (PFlow+JES) r 1 = 0.60
3000
2500 jet 2 p reco reco T ∈ [50,70] GeV r r 1 = 0.84 = 1.00 jet 2 p reco reco T ∈ [50,70] GeV r r 2 = 0.84 = 1.00 2500 jet 2 p reco reco T ∈ [35,50] GeV r r 1 = 0.84 = 1.00
Events / 2 GeV jet p ∈ [70,100] GeV 1 Events / 2 GeV 2500 jet p ∈ [70,100] GeV 2 Events / 2 GeV jet p ∈ [70,100] GeV 1
2000 | η 1 | < 0.8 T r 1 = 1.16 2000 | η 1 | < 0.8 T r 2 = 1.16 2000 | η 1 | < 0.8 T r 1 = 1.16
jet r = 1.40 jet r = 1.40 jet r = 1.40
1500 1 1500 2 1500 1
1000 1000 1000
500 500 500
60 80 100 60 80 100 60 80 100
1.2
W mass [GeV] 1.2 W mass [GeV] 1.1 W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8 0.9
0.8 60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(d) (e) (f)
4000 -1 -1 -1
s = 13 TeV, 140 fb JER s = 13 TeV, 140 fb JER 6000 s = 13 TeV, 140 fb JER
3500 anti-k R = 0.4 (PFlow+JES) r 2 = 0.60 5000 anti-k R = 0.4 (PFlow+JES) r 1 = 0.60 anti-k R = 0.4 (PFlow+JES) r 2 = 0.60
t t t
3000 jet p reco ∈ [35,50] GeV r 2 = 0.84 4000 jet p reco ∈ [20,35] GeV r 1 = 0.84 5000 jet p reco ∈ [20,35] GeV r 2 = 0.84
2 T 2 T 2 T
Events / 2 GeV 2500 jet 1 p reco T ∈ [70,100] GeV r r 2 = 1.00 = 1.16 Events / 2 GeV jet 1 p reco T ∈ [70,100] GeV r r 1 = 1.00 = 1.16 Events / 2 GeV 4000 jet 1 p reco T ∈ [70,100] GeV r r 2 = 1.00 = 1.16
2 1 2
2000 | η jet | < 0.8 r 2 = 1.40 3000 | η jet | < 0.8 r 1 = 1.40 3000 | η jet | < 0.8 r 2 = 1.40
1500 2000
2000
1000
1000
500 1000
60 80 100 60 80 100 60 80 100
1.2 W mass [GeV] 1.1 W mass [GeV] 1.2 W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8 0.9 0.8
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(g) (h) (i)
8000
4500 s = 13 TeV, 140 fb -1 JER 5000 s = 13 TeV, 140 fb -1 JER s = 13 TeV, 140 fb -1 JER
4000 anti-k t R = 0.4 (PFlow+JES) r 1 = 0.60 anti-k t R = 0.4 (PFlow+JES) r 2 = 0.60 7000 anti-k t R = 0.4 (PFlow+JES) r 1 = 0.60
3500 jet p reco ∈ [35,50] GeV r 1 = 0.84 4000 jet p reco ∈ [35,50] GeV r 2 = 0.84 6000 jet p reco ∈ [20,35] GeV r 1 = 0.84
Events / 2 GeV 3000 jet 2 1 p reco T T ∈ [50,70] GeV r 1 = 1.00 Events / 2 GeV 3000 jet 2 1 p reco T T ∈ [50,70] GeV r 2 = 1.00 Events / 2 GeV 5000 jet 2 1 p reco T T ∈ [50,70] GeV r 1 = 1.00
2500 | η jet | < 0.8 r r 1 = 1.16 = 1.40 | η jet | < 0.8 r r 2 = 1.16 = 1.40 4000 | η jet | < 0.8 r r 1 = 1.16 = 1.40
2000 1 2000 2 3000 1
1500
1000 1000 2000
500 1000
60 80 100 60 80 100 60 80 100
1.2
1.1 W mass [GeV] W mass [GeV] 1.1 W mass [GeV]
1 1 1
Variation w.r.t. r = 1 Variation w.r.t. r = 1 Variation w.r.t. r = 1
0.9 0.8 0.9
60 80 100 60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(j) (k) (l)
8000 s = 13 TeV, 140 fb -1 JER 3500 s = 13 TeV, 140 fb -1 JER 3500 s = 13 TeV, 140 fb -1 JER
7000 anti-k t R = 0.4 (PFlow+JES) r 2 = 0.60 3000 anti-k t R = 0.4 (PFlow+JES) r 1 = 0.60 3000 anti-k t R = 0.4 (PFlow+JES) r 2 = 0.60
6000 jet 2 p reco T ∈ [20,35] GeV r r 2 = 0.84 = 1.00 2500 jet 2 p reco T ∈ [20,35] GeV r r 1 = 0.84 = 1.00 2500 jet 2 p reco T ∈ [20,35] GeV r r 2 = 0.84 = 1.00
reco reco reco
Events / 2 GeV 5000 jet 1 p T ∈ [50,70] GeV r 2 2 = 1.16 Events / 1 GeV 2000 jet 1 p T ∈ [35,50] GeV r 1 1 = 1.16 Events / 1 GeV jet 1 p T ∈ [35,50] GeV r 2 2 = 1.16
| η | < 0.8 | η | < 0.8 2000 | η | < 0.8
4000 jet r 2 = 1.40 jet r 1 = 1.40 jet r 2 = 1.40
1500
3000 1500
2000 1000 1000
1000 500 500
60 80 100 50 60 70 80 90 100 1.2 50 60 70 80 90 100
1.2
W mass [GeV] 1.1 W mass [GeV] W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.9
0.8 0.8
60 80 100 50 60 70 80 90 100 50 60 70 80 90 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(m) (n) (o)
Figure D.5: Template W -boson mass distributions for various corrections r 1 or r 2 to the
JER of the leading or sub-leading jet from W decay, respectively. Run 2 templates in the
different off-diagonal regions are shown. The JES correction factor, s , is fixed to unity.


<!-- Page 79 -->


### Appendix E


## Run 3 W -mass templates

1400
700 -1 ATLAS Simulation
s = 13.6 TeV, 52 fb JES 1200 -1 JES
600 anti-k t R = 0.4 (PFlow+JES) s = 0.95 s = 13.6 TeV, 52 fb s = 0.95
reco s = 0.98 1000 anti-k t R = 0.4 (PFlow+JES) s = 0.98
500 jets p T ∈ [20,35] GeV s = 1.00 jets p reco ∈ [35,50] GeV s = 1.00
Events / 3 GeV | η | < 0.8 Events / 2 GeV T
400 jet s = 1.02 800 | η jet | < 0.8 s = 1.02
s = 1.05 s = 1.05
300 600
200 400
100 200
50 60 70 80 1.5 60 80 100
1.1 W mass [GeV] W mass [GeV]
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.9
50 60 70 80 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(a) (b)
800
ATLAS Simulation ATLAS Simulation
700 s = 13.6 TeV, 52 fb -1 JES 600 s = 13.6 TeV, 52 fb -1 JES
s = 0.95 s = 0.95
600 anti-k t R = 0.4 (PFlow+JES) s = 0.98 500 anti-k t R = 0.4 (PFlow+JES) s = 0.98
reco reco
Events / 2 GeV 500 jets p T ∈ [50,70] GeV s = 1.00 Events / 2 GeV 400 jets p T ∈ [70,100] GeV s = 1.00
| η | < 0.8 s = 1.02 | η | < 0.8 s = 1.02
400 jet s = 1.05 jet s = 1.05
300
300
200
200
100 100
60 80 100 60 80 100
1.5 2
W mass [GeV] W mass [GeV]
1.5
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.5
60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(c) (d)
Figure E.1: Template W -boson mass distributions for various corrections s or r , to JES
or JER, respectively. Run 3 templates in the different diagonal regions are shown. For JES
variations, the JER correction, r , is set to one, and vice versa.


<!-- Page 80 -->

80 Appendix E. Run 3 W -mass templates
800 25
ATLAS Simulation ATLAS Simulation
700 s = 13.6 TeV, 52 fb -1 JES s = 13.6 TeV, 52 fb -1 JES
s = 0.95 20 s = 0.95
600 anti-k t R = 0.4 (PFlow+JES) s = 0.98 anti-k t R = 0.4 (PFlow+JES) s = 0.98
reco reco
Events / 3 GeV 500 jets p T ∈ [100,150] GeV s = 1.00 Events / 2 GeV 15 jets p T ∈ [150,200] GeV s = 1.00
| η | < 0.8 s = 1.02 | η | < 0.8 s = 1.02
400 jet s = 1.05 jet s = 1.05
300 10
200
5
100
60 80 100 70 80 90 100 110
2 3
W mass [GeV] W mass [GeV]
1.5 2
Variation w.r.t. s = 1 1 Variation w.r.t. s = 1 1
0.5
60 80 100 0 70 80 90 100 110
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(e) (f)
700 1600
s = 13.6 TeV, 52 fb -1 JER ATLAS Simulation JER
600 r = 0.60 1400 s = 13.6 TeV, 52 fb -1 r = 0.60
anti-k t R = 0.4 (PFlow+JES)
500 jets p reco ∈ [20,35] GeV r = 0.84 1200 anti-k reco t R = 0.4 (PFlow+JES) r = 0.84
T jets p ∈ [35,50] GeV
Events / 3 GeV | η | < 0.8 r = 1.00 Events / 2 GeV T r = 1.00
400 jet r = 1.16 1000 | η jet | < 0.8 r = 1.16
r = 1.40 800 r = 1.40
300
600
200 400
100 200
50 60 70 80 60 80 100
1.2
W mass [GeV] 1.2 W mass [GeV]
1 1
Variation w.r.t. r = 1 Variation w.r.t. r = 1
0.8 0.8
50 60 70 80 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(g) (h)
1000 ATLAS Simulation 800 ATLAS Simulation
s = 13.6 TeV, 52 fb -1 JER s = 13.6 TeV, 52 fb -1 JER
800 anti-k R = 0.4 (PFlow+JES) r = 0.60 700 anti-k R = 0.4 (PFlow+JES) r = 0.60
reco t r = 0.84 600 reco t r = 0.84
jets p T ∈ [50,70] GeV r = 1.00 jets p T ∈ [70,100] GeV r = 1.00
Events / 2 GeV 600 | η | < 0.8 r = 1.16 Events / 2 GeV 500 | η | < 0.8 r = 1.16
jet jet
r = 1.40 400 r = 1.40
400 300
200 200
100
60 80 100 1.5 60 80 100
1.4
1.2 W mass [GeV] W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
0.8
60 80 100 60 80 100
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(i) (j)
900
12
800 ATLAS Simulation -1 JER s = 13.6 TeV, 52 fb -1 JER
s = 13.6 TeV, 52 fb
700 anti-k R = 0.4 (PFlow+JES) r = 0.60 10 anti-k t R = 0.4 (PFlow+JES) r = 0.60
t r = 0.84 reco r = 0.84
600 jets p reco ∈ [100,150] GeV r = 1.00 8 jets p T ∈ [150,200] GeV r = 1.00
Events / 3 GeV T Events / 2 GeV | η | < 0.8
500 | η jet | < 0.8 r = 1.16 jet r = 1.16
400 r = 1.40 6 r = 1.40
300 4
200
2
100
1.5 60 80 100 2 70 80 90 100 110
W mass [GeV] W mass [GeV]
Variation w.r.t. r = 1 1 Variation w.r.t. r = 1 1
60 80 100 0 70 80 90 100 110
Reconstructed W mass [GeV] Reconstructed W mass [GeV]
(k) (l)
Figure E.1: Template W -boson mass distributions for various corrections s or r , to JES
or JER, respectively. Run 3 templates in the different diagonal regions are shown. For JES
variations, the JER correction, r , is set to one, and vice versa.


<!-- Page 81 -->


### Appendix F


## JES and JER parametrisation


### F.1 JES parametrisation

81 s = 13 TeV, 140 fb -1 s = 13 TeV, 140 fb -1
[GeV] Template μ [GeV] 84 Template μ
μ 80.5 anti-k reco t R = 0.4 (PFlow+JES) Fit function μ anti-k reco t R = 0.4 (PFlow+JES) Fit function
jets p T ∈ [35,50] GeV, | η jet | < 0.8 83 jets p T ∈ [70,100] GeV, | η jet | < 0.8
80
W mass W mass
79.5 82
79 81
78.5 80
78
79
77.5
0.94 0.96 0.98 1 1.02 1.04 1.06 0.94 0.96 0.98 1 1.02 1.04 1.06
/fit /fit 1.0005
μ 1 μ
s (JES) parameter 0.9995 1 s (JES) parameter
0.9995 0.94 0.96 0.98 1 1.02 1.04 1.06 0.94 0.96 0.98 1 1.02 1.04 1.06
Template s (JES) parameter Template s (JES) parameter
(a) (b)
88
s = 13 TeV, 140 fb -1 s = 13 TeV, 140 fb -1
[GeV] μ 87 anti-k R = 0.4 (PFlow+JES) Template μ [GeV] μ 94.5 anti-k R = 0.4 (PFlow+JES) Template μ
reco t 94 reco t
Fit function Fit function
86 jets p T ∈ [100,150] GeV, | η jet | < 0.8 jets p T ∈ [150,200] GeV, | η jet | < 0.8
93.5
W mass W mass
85 93
84 92.5
92
83
91.5
82 91
81 90.5
1.0005 0.94 0.96 0.98 1 1.02 1.04 1.06 1.004 0.94 0.96 0.98 1 1.02 1.04 1.06
/fit μ /fit μ 1.002
1 s (JES) parameter 0.998 1 s (JES) parameter
0.9995
0.94 0.96 0.98 1 1.02 1.04 1.06 0.996 0.94 0.96 0.98 1 1.02 1.04 1.06
Template s (JES) parameter Template s (JES) parameter
(c) (d)
Figure F.1: The mean of the W -mass distribution as a function of JES ( s ), in the different
diagonal regions, for the Run 2 measurement. The fitted linear function F is shown by solid
red line. The bottom panel shows the ratio of the mean to the fitted function F .


<!-- Page 82 -->

82 Appendix F. JES and JER parametrisation
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [35,50] GeV, jet 2 p reco T ∈ [20,35] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [50,70] GeV, jet 2 p reco T ∈ [20,35] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
71.7 78
71.6 77.8
[GeV] 71.5 [GeV]
μ 71.4 μ 77.6
71.3 77.4
71.2 77.2
71.1 77
W mass 71 W mass 76.8
70.9 76.6
1.04 1.04
s (JES) parameter jet 1.02 s (JES) parameter jet 1.02
1 1.04 1 1.04
0.98 1 1.02 2 0.98 1 1.02 2
1 0.96 0.96 0.98 s (JES) parameter jet 1 0.96 0.96 0.98 s (JES) parameter jet
Fit function Fit function
(a) (b)
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [50,70] GeV, jet 2 p reco T ∈ [35,50] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [70,100] GeV, jet 2 p reco T ∈ [20,35] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
82
82.5 81.8
[GeV] [GeV] 81.6
μ 82 μ 81.4
81.2
81.5 81
81 80.6 80.8
W mass W mass
80.5 80.2 80.4
1.04 1.04
s (JES) parameter jet 1.02 s (JES) parameter jet 1.02
1 1.04 1 1.04
0.98 1 1.02 2 0.98 1 1.02 2
1 0.96 0.96 0.98 s (JES) parameter jet 1 0.96 0.96 0.98 s (JES) parameter jet
Fit function Fit function
(c) (d)
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [70,100] GeV, jet 2 p reco T ∈ [35,50] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [70,100] GeV, jet 2 p reco T ∈ [50,70] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
82.5
82 82
[GeV] μ 81.5 [GeV] μ 81.5
81 81
80.5 80.5
80
W mass 80 W mass 79.5
79.5 79
1.04 1.04
s (JES) parameter jet 1.02 s (JES) parameter jet 1.02
1 1.04 1 1.04
0.98 1 1.02 2 0.98 1 1.02 2
1 0.96 0.96 0.98 s (JES) parameter jet 1 0.96 0.96 0.98 s (JES) parameter jet
Fit function Fit function
(e) (f)
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [100,150] GeV, jet 2 p reco T ∈ [20,35] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [100,150] GeV, jet 2 p reco T ∈ [35,50] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
82.5
82
[GeV] 82 [GeV] 81.5
μ μ
81.5 81
80.5
81 80
W mass 80.5 W mass 79.5
79
1.04 1.04
s (JES) parameter jet 1.02 s (JES) parameter jet 1.02
1 1.04 1 1.04
0.98 1 1.02 2 0.98 1 1.02 2
1 0.96 0.96 0.98 s (JES) parameter jet 1 0.96 0.96 0.98 s (JES) parameter jet
Fit function Fit function
(g) (h)
Figure F.2: The mean of the W -mass distribution as a function of the JES parameters,
s 1 and s 2 , in the different off-diagonal regions with the leading jet denoted as jet 1 and the
sub-leading jet denoted as jet 2 , for the Run 2 measurement. The fitted two-dimensional
quadratic function F is shown in red.


<!-- Page 83 -->

F.1. JES parametrisation 83
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [100,150] GeV, jet 2 p reco T ∈ [50,70] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [100,150] GeV, jet 2 p reco T ∈ [70,100] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
83 84
82.5
[GeV] 82 [GeV] 83
μ 81.5 μ
81 82
80.5
80 81
W mass 79.5 W mass
79 80
1.04 1.04
s (JES) parameter jet 1.02 s (JES) parameter jet 1.02
1 1.04 1 1.04
0.98 1 1.02 2 0.98 1 1.02 2
1 0.96 0.96 0.98 s (JES) parameter jet 1 0.96 0.96 0.98 s (JES) parameter jet
Fit function Fit function
(i) (j)
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [150,200] GeV, jet 2 p reco T ∈ [20,35] GeV s = 13 TeV, 140 fb -1 jet 1 ∈ [150,200] GeV, jet 2 ∈ [50,70] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
82 84.5
[GeV] 81.5 [GeV] 83.5 84
μ 81 μ 83
82.5
80.5 82
81.5
W mass 80 W mass 81
80.5
79.5 80
1.04 1.04
s (JES) parameter jet 1.02 s (JES) parameter jet 1.02
1 1.04 1 1.04
0.98 1 1.02 2 0.98 1 1.02 2
1 0.96 0.96 0.98 s (JES) parameter jet 1 0.96 0.96 0.98 s (JES) parameter jet
Fit function Fit function
(k) (l)
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [150,200] GeV, jet 2 p reco T ∈ [70,100] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [150,200] GeV, jet 2 p reco T ∈ [100,150] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
86 88.5 89
[GeV] [GeV]
μ 85 μ 88
87.5
84 87
86.5
83 86
W mass W mass 85.5
82 85
84.5
1.04 1.04
s (JES) parameter jet 1.02 s (JES) parameter jet 1.02
1 1.04 1 1.04
0.98 1 1.02 2 0.98 1 1.02 2
1 0.96 0.96 0.98 s (JES) parameter jet 1 0.96 0.96 0.98 s (JES) parameter jet
Fit function Fit function
(m) (n)
Figure F.2: The mean of the W -mass distribution as a function of the JES parameters,
s 1 and s 2 , in the different off-diagonal regions with the leading jet denoted as jet 1 and the
sub-leading jet denoted as jet 2 , for the Run 2 measurement. The fitted two-dimensional
quadratic function F is shown in red.


<!-- Page 84 -->

84 Appendix F. JES and JER parametrisation

### F.2 JER parametrisation

9.8 s = 13 TeV, 140 fb -1 s = 13 TeV, 140 fb -1
[GeV] Template σ [GeV] Template σ
σ 9.6 anti-k t R = 0.4 (PFlow+JES) σ 10 anti-k t R = 0.4 (PFlow+JES)
reco Fit function reco Fit function
9.4 jets p T ∈ [35,50] GeV, | η jet | < 0.8 jets p T ∈ [70,100] GeV, | η jet | < 0.8
9.5
W mass 9.2 W mass
9
9
8.8
8.6 8.5
8.4
8.2 8
8
1.002 0.6 0.7 0.8 0.9 1 1.1 1.2 1.3 1.4 0.6 0.7 0.8 0.9 1 1.1 1.2 1.3 1.4
/fit /fit 1.002
σ 1 σ
0.998 r (JER) parameter 0.998 1 r (JER) parameter
0.6 0.7 0.8 0.9 1 1.1 1.2 1.3 1.4 0.6 0.7 0.8 0.9 1 1.1 1.2 1.3 1.4
Template r (JER) parameter Template r (JER) parameter
(a) (b)
8.4
-1
[GeV] 8.2 s = 13 TeV, 140 fb Template σ
σ anti-k R = 0.4 (PFlow+JES)
8 reco t Fit function
jets p ∈ [100,150] GeV, | η | < 0.8
7.8 T jet
W mass 7.6
7.4
7.2
7
6.8
6.6
6.4
1.005 6.2 0.6 0.7 0.8 0.9 1 1.1 1.2 1.3 1.4
/fit σ
1 r (JER) parameter
0.995
0.6 0.7 0.8 0.9 1 1.1 1.2 1.3 1.4
Template r (JER) parameter
(c)
Figure F.3: The standard deviation of the W -mass distribution as a function of JER ( r ), in
the different diagonal regions, for the Run 2 measurement. The fitted quadratic function F is
shown by solid red line. The bottom panel shows the ratio of the standard deviation to the
fitted function F .


<!-- Page 85 -->

F.2. JER parametrisation 85
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [35,50] GeV, jet 2 p reco T ∈ [20,35] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [50,70] GeV, jet 2 p reco T ∈ [20,35] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
7.32 9
7.3
7.28 8.9
[GeV] 7.26 [GeV] 8.8
σ 7.24 σ 8.7
7.22 8.6
7.2 8.5
7.18
W mass 7.16 W mass 8.4
7.14 8.3
7.12 8.2
1.4 1.4
r (JER) parameter jet 1.2 r (JER) parameter jet 1.2
1.4 1.4
1 1.2 1 1.2
0.8 1 0.8 1
0.8 2 0.8 2
1 0.6 0.6 r (JER) parameter jet 1 0.6 0.6 r (JER) parameter jet
Fit function Fit function
(a) (b)
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [70,100] GeV, jet 2 p reco T ∈ [20,35] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [100,150] GeV, jet 2 p reco T ∈ [20,35] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
10.4 11
[GeV] [GeV]
σ 10.2 σ 10.8
10 10.6
9.8 10.4
W mass W mass
9.6 10.2
1.4 1.4
r (JER) parameter jet 1.2 r (JER) parameter jet 1.2
1.4 1.4
1 1.2 1 1.2
0.8 1 0.8 1
0.8 2 0.8 2
1 0.6 0.6 r (JER) parameter jet 1 0.6 0.6 r (JER) parameter jet
Fit function Fit function
(c) (d)
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [150,200] GeV, jet 2 p reco T ∈ [20,35] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [50,70] GeV, jet 2 p reco T ∈ [35,50] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
10.4 10.6
[GeV] [GeV] 10.4
σ 10.2 σ
10.2
10 10
W mass 9.8 W mass 9.8
9.6
9.6
1.4 1.4
r (JER) parameter jet 1.2 r (JER) parameter jet 1.2
1.4 1.4
1 1.2 1 1.2
0.8 1 0.8 1
0.8 2 0.8 2
1 0.6 0.6 r (JER) parameter jet 1 0.6 0.6 r (JER) parameter jet
Fit function Fit function
(e) (f)
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [70,100] GeV, jet 2 p reco T ∈ [35,50] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [100,150] GeV, jet 2 p reco T ∈ [35,50] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
10.4 10
[GeV] 10.2 [GeV] 9.8
σ 10 σ 9.6
9.8 9.4
9.6 9.2
W mass 9.4 W mass 9
9.2 8.8
9 8.6
1.4 1.4
r (JER) parameter jet 1.2 r (JER) parameter jet 1.2
1.4 1.4
1 1.2 1 1.2
0.8 1 0.8 1
0.8 2 0.8 2
1 0.6 0.6 r (JER) parameter jet 1 0.6 0.6 r (JER) parameter jet
Fit function Fit function
(g) (h)
Figure F.4: The standard deviation of the W -mass distribution as a function of the JER
parameters, r 1 and r 2 , in the different off-diagonal regions with the leading jet denoted as jet 1
and the sub-leading jet denoted as jet 2 , for the Run 2 measurement. The fitted two-dimensional
quadratic function F is shown in red.


<!-- Page 86 -->

86 Appendix F. JES and JER parametrisation
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [70,100] GeV, jet 2 p reco T ∈ [50,70] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [100,150] GeV, jet 2 p reco T ∈ [50,70] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
9.8 9.4
[GeV] 9.6 [GeV] 9.2
σ 9.4 σ 9
9.2 8.8
9 8.6
8.8 8.4
W mass 8.6 W mass 8.2
8.4 8
1.4 1.4
r (JER) parameter jet 1.2 r (JER) parameter jet 1.2
1.4 1.4
1 1.2 1 1.2
0.8 1 0.8 1
0.8 2 0.8 2
1 0.6 0.6 r (JER) parameter jet 1 0.6 0.6 r (JER) parameter jet
Fit function Fit function
(i) (j)
s = 13 TeV, 140 fb -1 jet 1 ∈ [150,200] GeV, jet 2 ∈ [50,70] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [100,150] GeV, jet 2 p reco T ∈ [70,100] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
8.8 8.8
8.6 8.6
[GeV] 8.4 [GeV] 8.4
σ 8.2 σ 8.2
8 8
7.8 7.8
W mass 7.6 W mass 7.6
7.4 7.4
7.2 7.2
1.4 1.4
r (JER) parameter jet 1.2 r (JER) parameter jet 1.2
1.4 1.4
1 1.2 1 1.2
0.8 1 0.8 1
0.8 2 0.8 2
1 0.6 0.6 r (JER) parameter jet 1 0.6 0.6 r (JER) parameter jet
Fit function Fit function
(k) (l)
s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [150,200] GeV, jet 2 p reco T ∈ [70,100] GeV s = 13 TeV, 140 fb -1 jet 1 p reco T ∈ [150,200] GeV, jet 2 p reco T ∈ [100,150] GeV
anti-k t R = 0.4 (PFlow+JES) anti-k t R = 0.4 (PFlow+JES)
| η jet | < 0.8 | η jet | < 0.8
6.6
7.6
[GeV] 7.4 [GeV] 6.4
σ 7.2 σ 6.2
7
6.8 6
W mass 6.6 W mass 5.8
6.4
6.2 5.6
1.4 1.4
r (JER) parameter jet 1.2 r (JER) parameter jet 1.2
1.4 1.4
1 1.2 1 1.2
0.8 1 0.8 1
0.8 2 0.8 2
1 0.6 0.6 r (JER) parameter jet 1 0.6 0.6 r (JER) parameter jet
Fit function Fit function
(m) (n)
Figure F.4: The standard deviation of the W -mass distribution as a function of the JER
parameters, r 1 and r 2 , in the different off-diagonal regions with the leading jet denoted as jet 1
and the sub-leading jet denoted as jet 2 , for the Run 2 measurement. The fitted two-dimensional
quadratic function F is shown in red.


<!-- Page 87 -->


## Bibliography

[1] ATLAS Collaboration, ATLAS calorimeter performance Technical Design Report ,
(1996) (cit. on p. 1).
[2] Jet energy measurement and its systematic uncertainty in proton–proton
√
collisions at s = 7 TeV with the ATLAS detector ,
The European Physical Journal C 75 (2015), issn : 1434-6052,
url : http://dx.doi.org/10.1140/epjc/s10052-014-3190-y (cit. on p. 1).
[3] ATLAS Collaboration, Measurement of the top quark mass with the ATLAS
detector using t t ¯ events with a high transverse momentum top quark ,
Phys. Lett. B 867 (2025) 139608, arXiv: 2502.18216 [hep-ex] (cit. on p. 1).
[4] ATLAS Collaboration, Measurement of the top quark mass in the t t ¯ → dilepton
√
channel from s = 8 TeV ATLAS data , Phys. Lett. B 761 (2016) 350,
arXiv: 1606.02179 [hep-ex] (cit. on p. 1).
[5] ATLAS Collaboration, Measurement of the top quark mass in the
√
t t ¯ → lepton+jets and t t ¯ → dilepton channels using s = 7 TeV ATLAS data ,
Eur. Phys. J. C 75 (2015) 330, arXiv: 1503.05427 [hep-ex] (cit. on p. 1).
[6] CMS Collaboration, Measurement of the top quark mass with lepton+jets final
√
states using pp collisions at s = 13 TeV ,
The European Physical Journal C 78 (2018), issn : 1434-6052,
url : http://dx.doi.org/10.1140/epjc/s10052-018-6332-9 (cit. on p. 1).
[7] CDF Collaboration, Measurement of the top-quark mass in the lepton+jets
channel using a matrix element technique with the CDF II detector ,
Physical Review D 84 (2011), issn : 1550-2368,
url : http://dx.doi.org/10.1103/PhysRevD.84.071105 (cit. on p. 1).
[8] ATLAS Collaboration, Measurement of the t t ¯ production cross-section in the
√
lepton+jets channel at s = 13 TeV with the ATLAS experiment ,
Phys. Lett. B 810 (2020) 135797, arXiv: 2006.13076 [hep-ex] (cit. on p. 1).


<!-- Page 88 -->

88 Bibliography
[9] B. Nachman, Investigating the Quantum Properties of Jets and the Search for a
Supersymmetric Top Quark Partner with the ATLAS Detector, Thesis
(Ph.D.)–Stanford University , 2016, arXiv: 1609.03242 [hep-ex] ,
url : https://arxiv.org/abs/1609.03242 (cit. on p. 5).
[10] ATLAS Collaboration, Measurement of the ATLAS Detector Jet Mass Response
√
− 1
using Forward Folding with 80 fb of s = 13 TeV pp data ,
ATLAS-CONF-2020-022, 2020, url : https://cds.cern.ch/record/2724442
(cit. on p. 5).
[11] ATLAS Collaboration, Measurement of large radius jet mass reconstruction
√
performance at s = 8 TeV using the ATLAS detector , ATLAS-CONF-2016-008,
2016, url : https://cds.cern.ch/record/2139642 (cit. on p. 5).
[12] ATLAS Collaboration,
Measurements of differential cross-sections in top-quark pair events with a high
transverse momentum top quark and limits on beyond the Standard Model
contributions to top-quark pair production with the ATLAS detector at
√
s
= 13 TeV , Journal of High Energy Physics 2022 (2022), issn : 1029-8479,
url : http://dx.doi.org/10.1007/JHEP06(2022)063 (cit. on p. 16).
[13] A. Shmakov et al., SPANet: Generalized permutationless set assignment for
particle physics using symmetry preserving attention , SciPost Physics 12 (2022),
issn : 2542-4653, url : http://dx.doi.org/10.21468/SciPostPhys.12.5.178
(cit. on p. 20).
[14] J. Erdmann et al., A likelihood-based reconstruction algorithm for top-quark pairs
and the KLFitter framework ,
Nuclear Instruments and Methods in Physics Research Section A: Accelerators,
Spectrometers, Detectors and Associated Equipment 748 (2014) 18,
issn : 0168-9002, url : http://dx.doi.org/10.1016/j.nima.2014.02.029
(cit. on p. 20).
[15] ATLAS Collaboration, Calibration of the jet energy scale and resolution of
small-radius jets using semileptonic t t ¯ events with the ATLAS detector , 2025,
arXiv: 2512.17482 [hep-ex] , url : https://arxiv.org/abs/2512.17482
(cit. on pp. 23, 37, 38, 40, 41, 55, 56).


<!-- Page 89 -->


### Bibliography 89

[16] ATLAS Collaboration,
Software and computing for Run 3 of the ATLAS experiment at the LHC ,
Eur. Phys. J. C 85 (2025) 234, arXiv: 2404.06335 [hep-ex] (cit. on p. 23).
[17] F. James and M. Winkler, MINUIT User’s Guide , (2004) (cit. on p. 41).
[18] W. Verkerke and D. Kirkby, The RooFit toolkit for data modeling ,
eConf C0303241 (2003) MOLT007, arXiv: physics/0306116 (cit. on p. 41).
[19] ATLAS Collaboration, Electron and photon performance measurements with the
ATLAS detector using the 2015–2017 LHC proton–proton collision data ,
JINST 14 (2019) P12006, arXiv: 1908.00005 [hep-ex] .
[20] ATLAS Collaboration, Muon reconstruction and identification efficiency in
√
ATLAS using the full Run 2 pp collision data set at s = 13 TeV ,
Eur. Phys. J. C 81 (2021) 578, arXiv: 2012.00578 [hep-ex] .
[21] ATLAS Collaboration,
Performance of electron and photon triggers in ATLAS during LHC Run 2 ,
Eur. Phys. J. C 80 (2020) 47, arXiv: 1909.00761 [hep-ex] .
[22] ATLAS Collaboration, Performance of the ATLAS muon triggers in Run 2 ,
JINST 15 (2020) P09015, arXiv: 2004.13447 [physics.ins-det] .
[23] ATLAS Collaboration, Muon reconstruction performance of the ATLAS detector
√
in proton–proton collision data at s = 13 TeV , Eur. Phys. J. C 76 (2016) 292,
arXiv: 1603.05598 [hep-ex] .
[24] ATLAS Collaboration, Jet energy scale and resolution measured in proton–proton
√
collisions at s = 13 TeV with the ATLAS detector ,
The European Physical Journal C 81 (2021) 73, arXiv: 2007.02645 [hep-ex] .
[25] ATLAS Collaboration, ATLAS b -jet identification performance and efficiency
√
measurement with t t ¯ events in pp collisions at s = 13 TeV ,
Eur. Phys. J. C 79 (2019) 970, arXiv: 1907.05120 [hep-ex] .
[26] ATLAS Collaboration, Luminosity determination in pp collisions at
√
s = 13 TeV using the ATLAS detector at the LHC ,
Eur. Phys. J. C 83 (2023) 982, arXiv: 2212.09379 [hep-ex] .
[27] ATLAS Collaboration, Summary of ATLAS Pythia 8 tunes ,
ATL-PHYS-PUB-2012-003, 2012,
url : https://cds.cern.ch/record/1474107 .


<!-- Page 90 -->

90 Bibliography
[28] ATLAS Collaboration, Studies on the improvement of the matching uncertainty
definition in top-quark processes simulated with Powheg+Pythia8 ,
ATL-PHYS-PUB-2023-029, 2013,
url : https://cds.cern.ch/record/2872787 .
[29] ATLAS Collaboration, Comparison of Monte Carlo generator predictions to
ATLAS measurements of top pair production at 7 TeV ,
ATL-PHYS-PUB-2015-002, 2015,
url : https://cds.cern.ch/record/1981319 .
[30] ATLAS Collaboration, Comparison of Monte Carlo generator predictions from
Powheg and Sherpa to ATLAS measurements of top pair production at 7 TeV ,
ATL-PHYS-PUB-2015-011, 2015,
url : https://cds.cern.ch/record/2020602 .
[31] M. Czakon et al.,
Top-pair production at the LHC through NNLO QCD and NLO EW ,
JHEP 10 (2017) 186, arXiv: 1705.04105 [hep-ph] .
[32] A. Collaboration, Measurements of observables sensitive to colour reconnection in
√
t t ¯ events with the ATLAS detector at s = 13 TeV ,
The European Physical Journal C 83 (2023), issn : 1434-6052,
url : http://dx.doi.org/10.1140/epjc/s10052-023-11479-x .
[33] ATLAS Collaboration,
Measurement of the top-quark mass in t t ¯ → dilepton events with the ATLAS
experiment using the template method in 13 TeV pp collision data ,
ATLAS-CONF-2022-058, 2022, url : https://cds.cern.ch/record/2826701 .
[34] ATLAS Collaboration, Measurement of the top-quark mass using a leptonic
√
invariant mass in pp collisions at s = 13 TeV with the ATLAS detector ,
JHEP 06 (2023) 019, arXiv: 2209.00583 [hep-ex] .
[35] J. Butterworth et al., PDF4LHC recommendations for LHC Run II ,
J. Phys. G 43 (2016) 023001, arXiv: 1510.03865 [hep-ph] .
[36] R. D. Ball et al.,
The PDF4LHC21 combination of global PDF fits for the LHC Run III ,
J. Phys. G 49 (2022) 080501, arXiv: 2203.05506 [hep-ph] .
[37] B. Andersson, G. Gustafson, and B. Söderberg,
A General Model for Jet Fragmentation , Z. Phys. C 20 (1983) 317.


<!-- Page 91 -->


### Bibliography 91

+ −
[38] M. G. Bowler, e e Production of Heavy Quarks in the String Model ,
Z. Phys. C 11 (1981) 169.
[39] ATLAS Collaboration, Performance of top-quark and W -boson tagging with
ATLAS in Run 2 of the LHC , Eur. Phys. J. C 79 (2019) 375,
arXiv: 1808.07858 [hep-ex] .
[40] ATLAS Collaboration,
ATLAS measurements of the properties of jets for boosted particle searches ,
Phys. Rev. D 86 (2012) 072006, arXiv: 1206.5369 [hep-ex] .