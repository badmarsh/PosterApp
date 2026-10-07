# Referee Report (Posudok)

## *The τ-model of Bose–Einstein Correlations: Some Recent Results*  
### Critical assessment of the 7 TeV ATLAS-related Bose–Einstein-correlation analysis

**Material submitted for review:** W. J. Metzger, arXiv:1512.04301v1 (14 December 2015), subsequently published in *EPJ Web of Conferences* **120** (2016) 01003, DOI: 10.1051/epjconf/201612001003.  
**Requested title:** “Two-particle Bose-Einstein correlations in pp collisions at 7 TeV with the ATLAS detector.”  
**Date of report:** 7 October 2026  
**Discipline:** Experimental high-energy physics / femtoscopy  
**Grading scale:** A (excellent), B (very good), C (good), D (satisfactory), E (sufficient), FX (fail)

---

## 1. Executive summary and recommendation

### 1.1 Essential bibliographic qualification

The supplied arXiv identifier does **not** resolve to a doctoral dissertation, nor does it have the title stated in the request. It resolves to Wesley J. Metzger’s six-page conference proceeding, **“The τ-model of Bose–Einstein Correlations: Some recent results,”** based on a talk at ISMD 2015. Its abstract covers both hadronic Z decays and 7 TeV minimum-bias pp interactions. The paper explicitly says that the new pp results “are taken from a Ph.D. thesis [5]” (Sec. 1.3 in the arXiv version; Sec. 1.2 in the published version, PDF p. 2), and identifies that thesis as R. Astaloš, *Bose-Einstein correlations in 7 TeV proton-proton collisions in the ATLAS experiment* (Radboud University, 2015), Ref. [5]. The ATLAS Collaboration article using the same 7 TeV data is a separate work, Ref. [4]. This distinction is decisive: collaboration-level detector methodology cannot legitimately be credited to this proceeding merely because it uses the same event sample.

Accordingly, this report evaluates **the full text actually supplied by the user**—arXiv:1512.04301 and its six-page published rendering—as an ATLAS-related research synopsis. It does not pretend that omissions in a six-page proceeding are proof of omissions in Astaloš’s dissertation. Conversely, where a formal dissertation criterion requires track-quality definitions, Coulomb corrections, detector response, unfolding, purity corrections, covariance matrices, or a full systematic budget, the supplied work must be marked down because those elements are not auditable in it. Page references below follow the six-page EPJ PDF; section/equation/figure/table references also make the evidence unambiguous.

### 1.2 Overall scientific judgment

The strongest contribution is the clear identification of an anti-correlation region, approximately \(0.5<Q<1.5\) GeV, and the attempt to describe the BEC peak and this dip simultaneously with a τ-model-motivated oscillatory Lévy form. The source is unusually candid about important weaknesses: the one-dimensional τ-model prediction fails component-wise; the parameters \(\alpha\), \(R\), and \(R_a\) are highly correlated; results depend strongly on the reference sample; and Table 1 shows drastic dependence on the upper fit boundary. These admissions are scientifically valuable and make the proceeding a useful diagnostic study.

The central weakness is that the pp fits do **not** test the defining τ-model constraint. Equation (3b) predicts

\[
  R_a^{2\alpha}=\tan\!\left(\frac{\pi\alpha}{2}\right)R^{2\alpha},
\]

but in the pp analysis \(R_a\) is allowed to float. Using the Table 1 central values, the empirical quantity \((R_a/R)^{2\alpha}\) is 1.212, 0.742, 0.679, and 0.667 for upper fit limits of 2, 3, 4, and 5 GeV, whereas Eq. (3b) predicts 0.171, 0.301, 0.387, and 0.435. The empirical-to-predicted ratios are therefore about 7.08, 2.47, 1.76, and 1.54. Thus the reported pp fit establishes, at most, that an **unconstrained cosine-times-Lévy empirical ansatz** is useful; it does not validate the τ-model relation. The proceeding itself partly concedes this by saying, “regardless of the validity of the τ-model, Eq. (3) provides a good description of the data” (Sec. 1.2, PDF p. 2).

Table 1 is more damaging still. Raising \(Q_U\) from 2 to 5 GeV moves \(\alpha\) from \(0.108\pm0.001\) to \(0.261\pm0.003\), \(R\) from \(17.8\pm0.7\) fm to \(3.3\pm0.1\) fm, \(R_a\) from \(43.4\pm1.2\) fm to \(1.52\pm0.02\) fm, and \(\lambda\) from \(3.08\pm0.05\) to \(1.15\pm0.03\) (Sec. 2, Table 1, PDF p. 5). These shifts dwarf the tabulated statistical errors and indicate baseline/model misspecification rather than stable femtoscopic observables. The authors explicitly acknowledge: “Clearly the parametrization does not fully describe the data” (Sec. 2, PDF p. 5).

### 1.3 Recommended grade

**Final recommended grade for the scientific research synopsis: C (Good), with major reservations.**

**Formal dissertation verdict on the supplied document alone: FX (Fail / not assessable as a dissertation).** It is a six-page single-author conference proceeding, not the doctoral dissertation named in its Ref. [5]. It cannot satisfy dissertation-level requirements for complete methods, detector validation, uncertainty propagation, literature synthesis, and reproducibility. This is a documentary/scope verdict, not a claim that the underlying Astaloš thesis failed.

The grade **C** recognizes a relevant question, a large data sample, a useful comparison of reference constructions, insightful phenomenological observations, and unusually transparent acknowledgment of model failure. It is held below B because the claimed physical interpretation is not established by the fit actually performed, the fitted parameters are severely range-dependent, goodness-of-fit and covariance information are not tabulated, and essential ATLAS analysis details are delegated to other documents.

### 1.4 Grade profile

| No. | Criterion | Grade |
|---:|---|:---:|
| 1 | Relevance and problem formulation | **B** |
| 2 | Clarity and fulfillment of objectives | **C** |
| 3 | Theoretical background and state of the art | **C** |
| 4 | Methodological rigor and research design | **D** |
| 5 | Analytical and experimental execution | **D** |
| 6 | Validity and interpretation of results | **D** |
| 7 | Discussion and relation to literature | **C** |
| 8 | Originality and scientific contribution | **B** |
| 9 | Structure, language, and formal presentation | **C** |
| 10 | Citation quality and literature work | **D** |
| 11 | Ethics and research transparency | **C** |
| 12 | Limitations and future work | **B** |

---

## 2. Itemized evaluation under the twelve criteria

## Criterion 1 — Relevance and problem formulation  
### **Rating: B (Very Good)**

The subject is highly relevant to soft-QCD and femtoscopy. Two-particle Bose–Einstein interference gives access, albeit model-dependently, to the space-time structure of hadron production. The paper formulates a concrete problem that standard short-range Gaussian or Lévy forms miss: the correlation function is below unity over an intermediate-\(Q\) interval. The exact motivation is stated clearly: “there is a region of anti-correlation (\(R_2<1\)) extending from about \(Q=0.5\) to 1.5 GeV” (Sec. 1.2, PDF p. 1), while Eqs. (1) and (2) contain only a positive enhancement above a smooth linear baseline. The cosine in Eq. (3a) can represent both the low-\(Q\) enhancement and intermediate-\(Q\) depletion.

The problem formulation is nevertheless narrower and less neutral than a dissertation-level formulation should be. The proceeding moves rapidly from failure of Eqs. (1)–(2) to the τ-model without systematically separating physical anti-correlation from reference-sample artifacts, resonance subtraction, energy-momentum conservation, minijet structure, baseline flexibility, and event-class mixing. It states that the τ-model gives a physical reason for the cosine and predicts Eq. (3b) (Sec. 1.2, Eq. (3b), PDF p. 2), but then does not enforce this prediction for pp. The real empirical question is therefore not “Is the τ-model validated?” but “Does an oscillatory Lévy-like form with a free dip scale describe these ratios better than tested alternatives?” This distinction should have been made in the aims.

**Verbatim evidence:** “However, the ‘classic’ parametrization of Eq. (1) is found to be inadequate, even when it is generalized to allow for a Lévy distribution of the source” (Sec. 1.2, immediately before Eq. (2), PDF p. 1). “The parameter \(R\) describes the BEC peak, and \(R_a\) describes the anti-correlation region” (Sec. 1.2, after Eqs. (3a)–(3b), PDF p. 2).

---

## Criterion 2 — Clarity and fulfillment of objectives  
### **Rating: C (Good)**

The introductory objective is understandable: after a brief review, present preliminary dependences of the correlation function on track and jet multiplicity, pair transverse momentum, and pair rapidity (Sec. 1, PDF p. 1). The paper does deliver plots concerning \(k_t\), multiplicity, rapidity, and “jettiness”: Figs. 3–6 examine extracted radii; Figs. 8–10 examine the anti-correlation shape; and Table 1 investigates fit-range dependence. In that descriptive sense, most announced objectives are addressed. The conclusion also returns coherently to the two candidate explanations—space-time/momentum correlation in the τ-model and finite pion size (Sec. 4, PDF pp. 5–6).

Fulfillment is only partial because several outputs are qualitative. The paper says that \(R\) increases with multiplicity but marks the result “not shown” (Sec. 2, PDF p. 4); no numerical hypothesis tests, model-ranking criterion, covariance matrix, or fit probability is provided. “Comes close to describing” (Sec. 2, discussion of Fig. 2, PDF p. 3) is not a quantitative success criterion. More seriously, the objective of assessing the τ-model is not met unless the pp fit is compared under the constrained Eq. (3b) and free-\(R_a\) hypotheses. Since the pp results use \(R_a\) as a free parameter, successful curve description cannot establish the defining physical prediction.

**Verbatim evidence:** “new *preliminary* results are presented on the dependence of the Bose-Einstein correlation function on track and jet multiplicity, pair transverse momentum and pair rapidity” (Sec. 1, PDF p. 1). “For both \(e^+e^-\) and pp, \(R\) is found to increase with multiplicity (not shown)” (Sec. 2, PDF p. 4). The word “preliminary” appropriately limits the strength of any thesis-level claim.

---

## Criterion 3 — Theoretical background and state of the art  
### **Rating: C (Good)**

The compact theoretical sequence is logically effective. Equation (1) introduces the Gaussian source form; Eq. (2) generalizes it to a Lévy index \(0<\alpha\le2\); Eqs. (3a)–(3b) add the oscillatory term and model relation between \(R\), \(R_a\), and \(\alpha\). The paper identifies the τ-model proper-time parameters—\(\alpha\), \(\Delta\tau\), and \(\tau_0\)—and states that the simplified parameterization assumes \(\tau_0=0\) (Sec. 1.2, PDF pp. 1–2). It also correctly emphasizes that fitted “radii” are effective scales, not direct geometric radii, and notes the model’s single-string inspiration and surprising apparent performance in three-jet data.

For a dissertation, however, the theoretical account is too compressed. It does not derive Eq. (3a), explain the assumptions connecting the emission function to the Fourier transform of a one-sided Lévy proper-time distribution, or discuss coherence, long-lived resonance dilution, final-state interactions, core–halo effects, and conservation-induced correlations. The phrase “strength parameter” is used through \(\lambda\), but no careful explanation is given for why fitted values exceed unity—indeed Table 1 has \(\lambda=3.08\pm0.05\) at \(Q_U=2\) GeV. The state-of-the-art review is nine references and does not include OPAL or ALICE, despite the requested LEP/LHC comparative framework.

**Verbatim evidence:** “Parameters of the model are the parameters of the Lévy distribution which describes the proper time of particle emission: \(\alpha\), the index of stability … a width parameter \(\Delta\tau\); and … \(\tau_0\)” (Sec. 1.2, PDF p. 1). The strongest self-criticism is exact and important: “The τ-model predicts that \(R_2\) depends on the two-particle momentum difference only through \(Q\), not through components of \(Q\). However, this is found not to be the case” (Sec. 1.2, PDF p. 2).

---

## Criterion 4 — Methodological rigor and research design  
### **Rating: D (Satisfactory)**

There are several sound design choices. The pp sample is large—approximately \(1.8\times10^9\) like-sign track pairs from \(10^7\) events—with \(|\eta|<2.5\) (Sec. 1.3, PDF p. 2). Most pp results use the opposite-hemisphere method, replacing one particle’s three-momentum \(\vec p\) by \(-\vec p\), and Fig. 3 compares unlike-sign (ULS), rotated (ROT), opposite-hemisphere (OHP), and mixed-event (MIX) references. This is valuable because the work demonstrates that the inferred \(R(N)\) and \(R(k_t)\) trends change markedly with reference construction (Sec. 2, Fig. 3, PDF p. 3). It also correctly warns that ULS is unsuitable for the BEAC region because \(\rho^0\to\pi^+\pi^-\) dominates there (Sec. 1.3, PDF p. 2).

The methodological record in the supplied source is nevertheless inadequate for reproduction. There is no explicit pp trigger description, vertex requirement, pile-up rejection, track hit requirement, impact-parameter cut, momentum uncertainty criterion, pair-merging/splitting treatment, charge-misidentification estimate, event-mixing class definition, or normalization interval. Coulomb final-state interactions are not described; neither are strong final-state interactions, pion purity, secondary-particle contamination, conversion rejection, or resonance systematics. A linear baseline \(\gamma(1+\epsilon Q)\) appears in Eqs. (1)–(3), but competing polynomial orders and baseline-control regions are not specified. No formal double-ratio definition is supplied in this proceeding. Such omissions may be covered by Ref. [4] or the thesis in Ref. [5], but they remain omissions from the document under review.

**Verbatim evidence:** “the new results reported here, which are taken from a Ph.D. thesis [5], use, unless otherwise stated, a reference sample constructed by the opposite-hemisphere (OHP) method” (Sec. 1.3, PDF p. 2). “The dependences with unlike-sign (ULS) reference sample are markedly different from those with the other samples” (Sec. 2, Fig. 3 discussion, PDF p. 3). These sentences expose reference choice as a leading design uncertainty but do not convert it into a quantified nuisance model.

---

## Criterion 5 — Analytical and experimental execution  
### **Rating: D (Satisfactory)**

The execution has substantial statistical power and a sensible differential program. The use of roughly ten million 7 TeV pp events permits multiplicity- and \(k_t\)-differential fits; the paper also performs a component test in the longitudinally comoving system by replacing \(R^2Q^2\) with \(R_L^2Q_L^2+R_{\rm side}^2Q_{\rm side}^2+R_{\rm out}^2Q_{\rm out}^2\) (Sec. 2, discussion preceding Fig. 6, PDF pp. 4–5). That test finds unequal components and identifies the transverse plane as the main source of the increase with jettiness. It is analytically stronger than relying exclusively on one-dimensional \(Q\).

However, detector-level execution is not auditable here. The source supplies no momentum-resolution propagation, no low-\(Q\) two-track efficiency study, no response matrix, no unfolding procedure, and no demonstration that unfolding is unnecessary. It does not quantify purity corrections or detector systematic uncertainties, nor does it present closure tests on simulation. Parameters are stabilized by fixing \(\alpha\) to an inclusive-fit value (Sec. 2, PDF p. 3), but the induced uncertainty and bin-to-bin correlation are not propagated. Fixing a globally fitted parameter is defensible, but only if its uncertainty is profiled or propagated; otherwise differential error bars can be understated.

**Verbatim evidence:** “the estimates of \(\alpha\), \(R\), and \(R_a\) from the fits tend to be highly correlated. Therefore … in order to stabilize the fits \(\alpha\) is fixed to the value obtained in a fit to all events” (Sec. 2, PDF p. 3). “Different values were found for \(R_L\), \(R_{out}\), and \(R_{side}\)” (Sec. 2, PDF p. 4). The first quotation identifies a real numerical problem; the second shows that the one-dimensional model assumption fails experimentally.

---

## Criterion 6 — Validity and interpretation of results  
### **Rating: D (Satisfactory)**

### Parameter stability

Table 1 reveals severe non-robustness. As \(Q_U\) changes from 2 to 3, 4, and 5 GeV, \(\alpha\) changes 0.108 → 0.186 → 0.235 → 0.261; \(R\) changes 17.8 → 6.7 → 4.1 → 3.3 fm; \(R_a\) changes 43.4 → 3.0 → 1.80 → 1.52 fm; and \(\lambda\) changes 3.08 → 1.91 → 1.36 → 1.15 (Sec. 2, Table 1, PDF p. 5). Relative to the quoted fit uncertainties, these are enormous shifts. Even the change from 4 to 5 GeV—where one might hope for baseline stabilization—is about 0.026 in \(\alpha\), 0.8 fm in \(R\), 0.28 fm in \(R_a\), and 0.21 in \(\lambda\), all many times the listed statistical errors. The quoted parameters therefore cannot be interpreted as stable source characteristics without a dominant model/range systematic.

The paper correctly states both the mechanism and the consequence: the upper range supplies baseline leverage, and changing it “drastically” alters the parameters; “Clearly the parametrization does not fully describe the data” (Sec. 2, immediately before Table 1, PDF p. 5). This candor is commendable, but it also prevents a strong physical inference. Values \(R=17.8\) fm and \(R_a=43.4\) fm in minimum-bias pp, together with \(\lambda>3\), should be treated as symptoms of parameter degeneracy and baseline absorption, not literal femtoscopic dimensions or chaoticity.

### Test of the τ-model relation

The model prediction in Eq. (3b) can be tested directly through

\[
  X_{\rm fit}=\left(\frac{R_a}{R}\right)^{2\alpha},
  \qquad
  X_{\tau}=\tan\left(\frac{\pi\alpha}{2}\right).
\]

Using the exact Table 1 central values gives:

| \(Q_U\) (GeV) | \(X_{\rm fit}=(R_a/R)^{2\alpha}\) | \(X_\tau=\tan(\pi\alpha/2)\) | \(X_{\rm fit}/X_\tau\) |
|---:|---:|---:|---:|
| 2 | 1.212 | 0.171 | 7.08 |
| 3 | 0.742 | 0.301 | 2.47 |
| 4 | 0.679 | 0.387 | 1.76 |
| 5 | 0.667 | 0.435 | 1.54 |

For orientation only, naïve propagation of the tabulated marginal uncertainties while neglecting their acknowledged covariance gives \(X_{\rm fit}=1.212\pm0.013\), \(0.742\pm0.028\), \(0.679\pm0.017\), and \(0.667\pm0.012\), compared with \(X_\tau=0.171\pm0.002\), \(0.301\pm0.009\), \(0.387\pm0.005\), and \(0.435\pm0.006\). These uncertainty comparisons are **not formal significances**, because the covariance matrix and fit-range systematic are absent and the paper explicitly says the parameters are highly correlated. The central-value discrepancy is nevertheless large and systematic at every range.

The decisive interpretive point is that Table 1 is captioned as fits “with \(R_a\) a free parameter” (Sec. 2, Table 1, PDF p. 5), whereas Eq. (3b) is the model’s prediction. The data therefore do not validate the τ-model relation. They validate only the flexibility of Eq. (3a) when decoupled from Eq. (3b). The conclusion that the τ-model “provides a reasonable explanation” (Sec. 4, PDF p. 5) is too strong unless accompanied by constrained-fit quality, likelihood-ratio comparison, residuals, and systematic uncertainty. A more defensible conclusion is that the τ-inspired form is a useful empirical interpolant and that its physical constraint is disfavored or, at minimum, untested in the reported pp fit.

---

## Criterion 7 — Discussion and relation to literature  
### **Rating: C (Good)**

The paper makes useful cross-system comparisons. L3 provides the hadronic-Z benchmark, including the published two-jet value \(\alpha=0.41\pm0.02^{+0.04}_{-0.06}\), explicitly contrasted with the smaller pp values (Sec. 2, PDF p. 5). CMS is cited for observing the dip and fitting the τ-model form and for the weakening of the dip with multiplicity (Secs. 2–3, Refs. [6], PDF pp. 3 and 5). The ATLAS collaboration article using the same pp sample is identified separately as Ref. [4], and the paper explains why its unlike-sign reference is problematic specifically for BEAC.

The literature discussion is too selective for a dissertation review. OPAL and ALICE are absent; LHCb is mentioned only generically in the conclusion, not referenced; and there is no quantitative reconciliation with published ATLAS/CMS radius and \(\lambda\) conventions. The proceeding says quantitative comparison across reference samples is “very difficult, if not impossible” (Sec. 4, PDF p. 6), which is true as a warning but should motivate harmonized reanalysis rather than replace comparison. The alternative finite-pion-size mechanism is cited in Refs. [8]–[9], but no observable is proposed quantitatively to discriminate it from the τ-model.

**Verbatim evidence:** “Previously, CMS had also observed the BEAC and fit it with the τ-model parametrization” (Sec. 2, PDF p. 3). “It is very difficult, if not impossible, to compare quantitatively the results using different reference samples” (Sec. 4, PDF p. 6). References [1], [4], and [6] support L3, ATLAS, and CMS respectively; there is no OPAL or ALICE bibliographic entry in the nine-item reference list (PDF p. 6).

---

## Criterion 8 — Originality and scientific contribution  
### **Rating: B (Very Good)**

The application of a τ-inspired oscillatory parameterization to the ATLAS 7 TeV sample, with systematic exploration of multiplicity, \(k_t\), and reference-sample dependence, is an original and useful phenomenological contribution. Particularly valuable are the extension of the fit beyond the dip, the explicit fit-range scan in Fig. 7/Table 1, and the observation that ULS-reference trends differ qualitatively from OHP, rotated, and mixed references. These features expose how much “source radius” phenomenology is estimator- and baseline-dependent.

Originality does not automatically imply a validated model. Much of the detector sample and standard BEC result was already published by ATLAS (Ref. [4]), while the new results are attributed to Astaloš’s thesis (Ref. [5]). The proceeding’s distinctive contribution is therefore synthesis and τ-model interpretation, not independent collection or reconstruction of ATLAS data. Its most durable scientific contribution may be negative: demonstrating that fit-range dependence, anisotropy, and free-\(R_a\) behavior undermine a literal τ-model reading.

**Verbatim evidence:** “only this parametrization (with \(R_a\) a free parameter) comes close to describing not only the BEC peak but also the BEAC region” (Sec. 2, PDF p. 3). “The values of the parameters change drastically when the upper limit, \(Q_U\), is increased from 2 to 3 GeV” (Sec. 2, PDF p. 5). The latter is a meaningful robustness result even though it weakens the preferred interpretation.

---

## Criterion 9 — Structure, language, and formal presentation  
### **Rating: C (Good)**

The six-page proceeding is logically organized: introduction and parameterizations; data; preliminary results; focused BEAC discussion; conclusions. Equations (1)–(3) clearly distinguish Gaussian, Lévy, and oscillatory forms. Figures cover overall fits, reference dependence, differential trends, multidimensional radii, fit-range variation, and dip behavior. Table 1 is compact and central to the argument. The notation \(Q\), \(R\), \(R_a\), \(\alpha\), \(\lambda\), and \(k_t\) is mostly consistent.

Presentation weaknesses matter because the conclusions rely heavily on visual judgment. Several figures are densely packed and small in the six-page format; quantitative fit-quality tables are absent. The terminology “BEAC” risks implying that the sub-unity structure is itself a Bose–Einstein effect before competing baselines and non-BEC correlations are excluded. There are minor language and editing issues (“slighlty”; a duplicated “is shown in Fig. 4” construction in Sec. 2), and experiment names are stylized inconsistently in the arXiv rendering. More importantly, \(R\) and \(R_a\) are called radii without repeated emphasis that, under unstable highly correlated fits, they are effective shape scales.

**Verbatim evidence:** Figure 7 is explicitly “Fits of Eq. (3a), with \(R_a\) a free parameter … for various choices of upper limit of the fit range” (Fig. 7 caption, PDF p. 5). Figure 6 presents \(R_L\) and \(R_{side}/R_L\) (Fig. 6 caption, PDF p. 5), but the lack of accompanying numerical tables limits exact independent reading.

---

## Criterion 10 — Citation quality and literature work  
### **Rating: D (Satisfactory)**

The nine references are relevant and, within the supplied text, are used in recognizable roles: L3 for the detailed τ-model BEC study; foundational τ-model papers by Csörgő and collaborators; ATLAS for the shared dataset; Astaloš for the thesis-level source of new results; CMS for pp BEC/BEAC; and Białas–Zalewski for finite-pion-size alternatives. The bibliographic distinction among the ATLAS paper, thesis, and present proceeding is ethically and scientifically important. The published version includes arXiv identifiers for the ATLAS and CMS papers and a persistent handle for the thesis (Refs. [4]–[6], PDF p. 6).

For a dissertation-grade state-of-the-art review, nine citations are plainly insufficient. The source does not cite OPAL or ALICE, gives no dedicated detector-performance references, and does not document Coulomb/strong final-state correction methods, core–halo theory, conservation backgrounds, or systematic statistical methodology. Some broad claims—such as all other attempted parameterizations performing worse—are delegated to figures or Ref. [5] rather than supported with comparative metrics. Citation accuracy appears plausible for the works actually listed, but completeness is weak and no exhaustive verification can be performed from a six-page proceeding.

**Verbatim evidence:** Ref. [4] is “ATLAS Collab., G. Aad, et al., Eur. Phys. J. C75, 466 (2015), 1502.07947”; Ref. [5] is “R. Astaloš, Ph.D. thesis, Radboud University (2015)”; Ref. [6] is the CMS JHEP paper (References, PDF p. 6). The phrase “new results reported here … are taken from a Ph.D. thesis [5]” (Sec. 1.3, PDF p. 2) is accurate attribution, but it also confirms that this document is not that thesis.

---

## Criterion 11 — Ethics and research transparency  
### **Rating: C (Good)**

Attribution is generally responsible. The author states that the pp data are the same as the ATLAS sample, distinguishes the collaboration publication from the thesis-derived analysis, cites the thesis author, and labels the results preliminary. The paper openly reports failures and sensitivities rather than suppressing them: multidimensional breakdown, reference dependence, parameter correlation, and fit-range instability are all acknowledged. This level of candor is a significant strength.

Transparency remains incomplete in the reproducibility sense. No data table for the plotted correlation functions, fit covariance matrices, software/configuration record, exact selection table, or systematic uncertainty decomposition is included in the supplied source. Table 1 quotes only one uncertainty per parameter without identifying it explicitly in the caption as statistical or total, and the dominant range/reference dependence is not consolidated into an uncertainty budget. The author’s claim that one parameterization is best cannot be audited through \(\chi^2/{\rm ndf}\), p-values, or information criteria.

**Verbatim evidence:** “A large source of systematic uncertainty on the parameter values is the range of \(Q\) over which the fit is performed” (Sec. 2, PDF p. 5). “The reference sample used plays a crucial role” (Sec. 4, PDF p. 6). These are transparent admissions, but the paper does not publish the full quantitative budget needed to operationalize them.

---

## Criterion 12 — Limitations and future work  
### **Rating: B (Very Good)**

This is one of the strongest parts. The paper explicitly states that the τ-model’s one-dimensional \(Q\)-only prediction fails and reports different \(R_L\), \(R_{out}\), and \(R_{side}\) values (Secs. 1.2 and 2, PDF pp. 2, 4–5). It identifies reference-sample choice and fit range as critical, recognizes an alternative finite-pion-size mechanism, and proposes studies of jets and rapidity in pp, including sensitivity to the number of strings and color reconnection (Sec. 4, PDF pp. 5–6). It also calls for a standard reference-sample prescription across LHC experiments.

The future-work program should be made more concrete. A compelling next analysis would publish three-dimensional LCMS correlations in multiplicity, \(k_t\), jet activity, and rapidity bins; compare constrained and unconstrained τ fits; use flexible but controlled baselines; propagate track/pair purity and Coulomb corrections; provide full covariance; and perform closure tests with generators lacking BEC. The non-Gaussian geometry should be reconstructed with imaging or multidimensional Lévy fits rather than summarized by a single effective radius. Multiplicity should be corrected consistently, with migration and trigger effects included, and the claimed saturation should be tested across reference constructions.

**Verbatim evidence:** “To discover which of these explanations (or what combination of them) is the best explanation requires detailed investigation of both BEC and BEAC” (Sec. 4, PDF p. 5). “It would therefore be useful if the LHC experiments could agree on a standard method of constructing the reference sample” (Sec. 4, PDF p. 6). These are appropriately cautious and forward-looking conclusions.

---

## 3. Consolidated substantive physics critique

### 3.1 What is measured, and what is model-dependent?

The observable \(R_2(Q)=\rho(Q)/\rho_0(Q)\) is not a source image. Its shape depends on detector effects, pair selection, final-state interactions, long-lived decays, conservation laws, jets, the reference \(\rho_0\), and the chosen baseline. The paper itself proves this dependence empirically in Fig. 3: the apparent multiplicity saturation and \(k_t\) slope change when the reference is changed. Consequently, \(R\), \(R_a\), and \(\lambda\) must be described as estimator-specific effective parameters, not universal source properties.

The linear factor \(\gamma(1+\epsilon Q)\) is especially important. Extending \(Q_U\) changes which broad structures determine \(\gamma\) and \(\epsilon\); the BEC/BEAC parameters then compensate for baseline mismatch. Table 1’s extreme migration is exactly what one expects under such coupling. A robust analysis should vary baseline families, fit control regions, and non-femtoscopic templates, then report profile likelihoods and full covariance.

### 3.2 Empirical fit versus physical τ-model test

Equation (3a) plus a free \(R_a\) contains an oscillatory degree of freedom tailored to put a dip below unity. Equation (3b) is what converts that useful shape into a distinctive τ-model prediction. The pp procedure breaks this logical chain by freeing \(R_a\). The comparison calculated above shows that the fitted ratios do not satisfy Eq. (3b) at any scanned \(Q_U\), even at the level of central values.

Therefore, the statement that “only that of the τ-model survives as a candidate to explain the data” (Sec. 4, PDF p. 5) should be weakened. What survives is the **functional architecture** of Eq. (3a), not yet the τ-model as a physical space-time emission theory. The proper test is a pair of fits with identical data, baseline, and nuisance treatment: (i) constrained Eq. (3b), and (ii) free \(R_a\), with a likelihood-ratio or information-criterion comparison plus systematic variations.

### 3.3 Parameter pathologies

The fitted \(\lambda>1\), reaching 3.08 at \(Q_U=2\) GeV, is not forbidden for an arbitrary ratio with a floating normalization and baseline, but it is incompatible with a naïve interpretation as a simple chaotic fraction. Likewise, tens-of-femtometre scales in minimum-bias pp are not credible literal homogeneity lengths. These values reinforce the conclusion that parameter correlations and broad-shape compensation dominate short-range physical interpretation.

The paper acknowledges high correlations but does not publish the correlation matrix. Without it one cannot determine whether the instability follows a nearly flat direction or whether the model is decisively incompatible with the data. Nor can one attach a valid significance to the Eq. (3b) discrepancy. Publishing Hessian/covariance matrices and profile contours in \((\alpha,R,R_a,\lambda,\epsilon)\) would be essential.

### 3.4 Multidimensional inconsistency

A central τ-model premise is dependence through invariant \(Q\) rather than independently through its components. The unequal LCMS scales directly contradict that simplifying premise. This is not a minor correction: anisotropy changes how a one-dimensional projection weights longitudinal, sideward, and outward structures as multiplicity and \(k_t\) change. A one-dimensional effective radius can therefore change because the source geometry or pair acceptance changes, even if no single physical radius follows the inferred trend.

The paper deserves credit for reporting the contradiction. However, once acknowledged, the one-dimensional pp conclusions should be framed as phenomenological summaries. A multidimensional model with explicit source anisotropy and emission duration is needed before assigning space-time meaning to \(R\) or interpreting its multiplicity dependence.

### 3.5 Reference construction and resonance bias

The criticism of unlike-sign references in the \(\rho^0\) region is well founded: opposite-charge pairs carry resonances absent from like-sign pairs. But OHP and mixed references also have biases. Momentum inversion can distort jets, acceptance, event-level conservation, and pair kinematics; event mixing removes genuine non-BEC correlations and must match multiplicity, vertex, topology, and other global properties. No reference is automatically “correct.”

The analysis should therefore treat reference methods as estimators with closure properties, not as interchangeable variants. Simulated samples without BEC should be passed through each construction; deviations from unity should form a correction or nuisance template. Only then can the observed dip be robustly assigned to space-time physics rather than reference mismatch.

---

## 4. Questions for the doctoral defense

1. **Document identity:** The supplied arXiv item is a conference proceeding by W. J. Metzger and cites the Astaloš dissertation as Ref. [5]. Which exact document and which chapters constitute the dissertation being defended, and which results are the candidate’s original work?

2. **Defining model test:** Why was \(R_a\) floated in pp when Eq. (3b) is the defining τ-model relation? Please show constrained and unconstrained fit qualities and state whether the likelihood improvement justifies violating Eq. (3b).

3. **Numerical discrepancy:** How do you interpret the Table 1 values yielding \((R_a/R)^{2\alpha}=1.212,0.742,0.679,0.667\), compared with \(\tan(\pi\alpha/2)=0.171,0.301,0.387,0.435\)? Is the τ-model falsified in its simplified form, or is some omitted assumption expected to repair the relation?

4. **Fit-range instability:** Which parameter set, if any, is quoted as the physical result? How is the 2–5 GeV variation converted into a systematic uncertainty, and why does the variation remain many statistical standard deviations between 4 and 5 GeV?

5. **Meaning of \(\lambda\):** What physical meaning can be assigned to \(\lambda=3.08\pm0.05\)? If none, should it continue to be called a chaoticity or correlation-strength parameter?

6. **Scale interpretation:** How can \(R=17.8\) fm and \(R_a=43.4\) fm in minimum-bias pp be reconciled with plausible homogeneity lengths? Are these values evidence of a flat fit direction or baseline misspecification?

7. **Parameter covariance:** Please provide the full covariance/correlation matrices for \(\alpha,R,R_a,\lambda,\gamma,\epsilon\) at each \(Q_U\). How do correlations alter the test of Eq. (3b)?

8. **Baseline model:** Why is the long-range baseline restricted to \(\gamma(1+\epsilon Q)\)? What happens with quadratic/cubic baselines, generator-derived non-femtoscopic templates, or control-region-constrained nuisance functions?

9. **Reference closure:** In no-BEC Monte Carlo, how closely do OHP, rotated, mixed-event, and ULS constructions recover unity after full reconstruction? Which event properties are matched in mixed events?

10. **OHP biases:** Reversing \(\vec p\) changes jet and conservation correlations. How are distortions of acceptance, topology, and pair transverse momentum quantified?

11. **Coulomb and strong FSI:** What Coulomb correction is applied at low \(Q\), with what source-size iteration and uncertainty? Are strong final-state interactions relevant for the inclusive charged-particle sample?

12. **Particle purity:** What fraction of selected tracks are pions? How are kaons, protons, secondaries, conversions, and long-lived resonance daughters propagated into \(R\) and \(\lambda\)?

13. **Detector response:** What are the two-track resolution and pair-efficiency corrections in the lowest-\(Q\) bins? Was unfolding performed; if not, what closure study demonstrates that smearing is negligible?

14. **Multiplicity migration:** Is multiplicity observed or corrected in every pp figure? How do tracking efficiency, trigger bias, and bin migration affect the apparent rise or saturation of \(R(N)\)?

15. **Fixed \(\alpha\):** When \(\alpha\) is fixed to the inclusive value in differential fits, how is its uncertainty propagated? Could an unmodeled \(\alpha(N,k_t)\) dependence create an artificial \(R(N,k_t)\) trend?

16. **One- versus three-dimensional model:** Since \(R_L\), \(R_{side}\), and \(R_{out}\) differ, in what precise sense does the \(Q\)-only τ-model remain applicable? What physical information is lost in projection?

17. **Goodness of fit:** Please provide \(\chi^2/{\rm ndf}\), p-values, residual distributions, and bin-to-bin covariance for all parameterizations in Fig. 2. What quantitative criterion supports “best described” and “comes close”?

18. **Alternative explanations:** Which observable can discriminate a coordinate–momentum-correlated τ source from the finite-pion-size mechanism of Refs. [8]–[9]? Give a falsifiable prediction for rapidity, jets, multiplicity, or three-dimensional components.

19. **Cross-experiment comparison:** How would you harmonize ATLAS, CMS, ALICE, OPAL/L3, and LHCb reference choices and kinematic acceptances so that radii and dip depths can be compared quantitatively?

20. **Reproducibility:** Which numerical data, analysis code, fit configurations, and covariance products are publicly available? Could an independent group reproduce Table 1 exactly from published material?

---

## 5. Final recommendation

The supplied research synopsis addresses a significant femtoscopic problem and contains several genuinely valuable observations, especially the reference-sample comparison, multidimensional contradiction, and fit-range scan. Its strongest scholarly feature is that it exposes rather than hides the fragility of the extracted parameters. As a concise conference contribution, it is useful and merits **C (Good)**.

It does **not**, however, establish the τ-model as the physical explanation of 7 TeV pp data. The pp fits release the model’s defining \(R_a\) constraint, the resulting central values violate Eq. (3b), and all principal parameters vary dramatically with fit range. The appropriate conclusion is empirical: Eq. (3a) with free \(R_a\) is a comparatively successful shape parameterization of the BEC peak and BEAC dip under particular reference and baseline choices.

If this six-page item itself were submitted as the doctoral dissertation, the recommendation would be **FX**, because it lacks the complete methods, detector validation, systematic budget, literature review, and reproducibility record required of a dissertation. A defensible final judgment on R. Astaloš’s actual 2015 thesis requires review of that thesis itself, not only the Metzger proceeding that cites it.

---

## 6. Primary sources consulted

1. W. J. Metzger, “The τ-model of Bose-Einstein Correlations: Some recent results,” arXiv:1512.04301v1 (2015), full text including Eqs. (1)–(3), Figs. 1–10, Table 1, and Refs. [1]–[9]: <https://arxiv.org/abs/1512.04301>.
2. Published six-page version, *EPJ Web of Conferences* **120** (2016) 01003, DOI: <https://doi.org/10.1051/epjconf/201612001003>.
3. ATLAS Collaboration, “Two-particle Bose–Einstein correlations in pp collisions at \(\sqrt{s}=0.9\) and 7 TeV measured with the ATLAS detector,” *Eur. Phys. J. C* **75** (2015) 466, identified as Ref. [4] in the reviewed source.
4. R. Astaloš, *Bose-Einstein correlations in 7 TeV proton-proton collisions in the ATLAS experiment*, Ph.D. thesis, Radboud University (2015), handle <http://hdl.handle.net/2066/143448>, identified as Ref. [5] in the reviewed source.

> **Scope note:** Exact quotations and page references in this report refer to source 1 as rendered in the six-page published PDF (source 2). Claims about what the supplied proceeding does *not* report are not claims that the separately archived dissertation or ATLAS collaboration paper lacks those items.
