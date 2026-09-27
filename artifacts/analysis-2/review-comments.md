# Reviewer comments on Analysis_2.pdf

This note reviews the chapter in `Analysis_2.pdf` only: JES and JER from the hadronic W boson in single-lepton tt̄, using forward folding. The file is a chapter excerpt, not a full dissertation. In the PDF the running line numbers begin at 94, and the text cites chapters and sections that are not in this file. Nothing below is a score for the rest of the thesis. Displayed equations did not survive text extraction cleanly, so formula layout is not treated as an author error. Every quotation is an exact span of the cleaned extraction.

The comments were written against a PosterApp index of this chapter, not against a substitute paper. Margin line numbers were stripped before chunking (771 of them). The index has 490 retrieval units, embedded with `Xenova/all-MiniLM-L6-v2` (384 dimensions, local ONNX, no hash fallback). Hugging Face was unreachable, so this index is not the production multilingual MiniLM. That model remains the default when the network is available. The vectors are in `artifacts/analysis-2/embeddings.json`. A probe query for the half-maximum likelihood sentence retrieved the §6.2 paragraph at cosine 0.58; the forward-folding formula retrieved §2.2 at 0.66.

## What should be fixed in this chapter

### 1. The statistical interval is not a 1σ interval

> The statistical uncertainty is obtained as the
> difference between the correction factors for which the likelihood is maximised and the
> ones for which the likelihood is half of the maximum value (which corresponds to one σ
> variation).
>
> PDF page 42.

For a Gaussian likelihood, the 1σ point is where −2ΔlnL = 1, so L = Lmax × e^(−1/2) ≈ 0.607 Lmax, not Lmax / 2. Half the maximum is −2ΔlnL = 2 ln 2 ≈ 1.386, about 1.18σ if the likelihood is parabolic. Taking the distance from the maximum to that point and calling it one σ overstates the statistical error by about 18% in the Gaussian case, and it is not a defined interval if the likelihood is not Gaussian. Replace the parenthetical with the −2ΔlnL = 1 definition, and say whether the quoted statistical error is the half-width of that interval or a one-sided difference. The same definition has to be used for every s_i and r_i, because Tables 7.1 and 7.2 are systematics-dominated and a reader will otherwise mix two conventions.

### 2. The JER uncertainty sentence does not match Table 7.2

> For the JER,
> the uncertainty ranges between 14 to 22% in the whole considered p T range.
>
> PDF page 47.

> 150 < p T < 200 0.997 0.995 0.0765 0.1220 0.2116 0.2528 0.2250 0.2808
>
> PDF page 48.

Table 7.2 gives total uncertainties of 0.225 (Run 2) and 0.281 (Run 3) in the 150–200 GeV bin, and 0.235 in the Run 3 20–35 GeV bin. Those are 22.5%, 28.1% and 23.5%, outside “14 to 22% in the whole considered p_T range”. The 14% floor matches the Run 2 50–70 GeV total (0.141), so the sentence is describing part of the table and then generalising. Quote the table, or change the sentence to the actual range. This matters because the highest bin is also the bin whose central value sits on unity (0.997 and 0.995). A reader who trusts the sentence will think that bin is constrained at the 22% level.

### 3. The pseudo-experiments, as written, do not use the correlations you just measured

> For each pseudo-experiment , JES or JER correction factors are sampled from
> Gaussian distributions whose means are given by the fitted correction factors, s i
> or r i , and whose standard deviations corresponds to their total uncertainties.
>
> PDF page 44.

> These correlations arise from the use of
> the off-diagonal analysis regions, which simultaneously constrain the correction factors
> associated with the p T bins of the leading and sub-leading jets. The correlations are
> obtained from the covariance matrix of the fitted parameters, which is determined from
> the inverse of the Hessian matrix at the likelihood minimum.
>
> PDF page 47.

Section 7.2 derives correlations from the Hessian and says they have to be kept when these factors are combined with the standard in situ corrections. The pseudo-experiment paragraph that produces the bands in Figures 7.1 and 7.2 specifies a Gaussian for each factor, with that factor’s total uncertainty, and does not mention the covariance. If the draws are independent, the band on μ in an off-diagonal region is wrong: s_1 and s_2 (or s_3) are anti-correlated precisely because the 20–35 GeV diagonal region is absent. State that each toy is drawn from the multivariate Gaussian with the fitted covariance, or show that independent draws were checked and do not move the bands. Also fix “standard deviations corresponds”.

### 4. The data correction is 1/s, but Table 7.1 is still in the MC convention

> Thus, to correct the JES in data,
> the inverse of the fitted values, alongside their uncertainties, needs to be applied to
> data.
>
> PDF page 43.

The text is right that these factors were fitted on simulation, so the factor applied to data is the inverse. The table and Figure 7.3 still quote s and σ_s. For a factor away from 1 the uncertainty does not transfer unchanged: σ(1/s) = σ_s / s². In the Run 2 20–35 GeV bin, s = 0.929 and σ_s = 0.0783, so the data factor is 1/0.929 = 1.076 and σ(1/s) = 0.0783 / 0.929² = 0.091, about 16% larger than the tabulated total. In the 150–200 GeV bin the difference is only a few percent. Add a data-scale column, or say explicitly that the published uncertainty is the MC-scale one and give the propagation. “Alongside their uncertainties” is not enough for the bin where the correction is largest.

### 5. The in situ JER smearing is omitted, and the systematic that replaces it is in an unresolved section

> The in situ JER calibration consists of
> smearing the p T of jets in simulation to reproduce the typically worse JER in data,
> as described in Section ?? . However, the corresponding smearing has not yet been
> derived for the current ATLAS reconstruction software release and it is therefore not
> used. The difference in JER between data and simulation is currently accounted for in
> the considered systematic uncertainties.
>
> PDF page 3.

> Unlike in the standard ATLAS in situ calibration techniques described in Chapter ?? ,
> there is no well-measured reference object to balance the jet system.
>
> PDF page 2.

This is the right thing to disclose. It is not yet a documented uncertainty. The sentence says the data/simulation JER difference “is currently accounted for in the considered systematic uncertainties”, and those uncertainties are the ones described in Section ?? and Chapter ??. This copy contains 37 unresolved `Section ??`, 4 `Chapter ??`, 1 `Equation ??`, and a literal `sec:background`. A reviewer cannot check whether the missing smearing is actually one of the nuisance parameters, or whether it is larger than the JER factors in Table 7.2. Resolve the labels, and add one row that shows the size of that particular uncertainty in each p_T bin. Until that row exists, the JER result is a constraint under an incomplete calibration, which the introduction already admits, and the result section should repeat the admission next to Table 7.2.

### 6. JES and JER are not fitted together

> When smearing jets with different JES ( s ) values, the JER ( r ) values are set to unity
> and vice-versa to generate pure JES and pure JER variations.
>
> PDF page 6.

> To account for the correlations between JES and JER, the JER systematic uncer-
> tainties (see Chapter ?? ) are considered in the JES measurement and vice versa.
>
> PDF page 3.

> the regions are statistically independent, they total likelihood function is constructed
> as a product of individual region likelihoods. Each analysis region corresponds to a
> particular combinations of two p T bins of the jets from W -boson decay.
>
> PDF page 42.

Setting r = 1 while varying s, and fitting the two measurements separately, is a defined choice. It is not the same as the correlation treatment in comment 3. A shift of the mean and a shift of the width are two parameters of the same peak, so the separate fits do not measure their correlation. The chapter says the other uncertainty is included as a systematic, and that systematic is cited as Chapter ??. Either show a joint (s, r) fit in one region, or show the shift in s when r is moved by its total uncertainty, with the number in this chapter. Also fix “they total likelihood” and “a particular combinations”.

### 7. Do not let the 20–35 GeV central value be read as the main JES result

> For the JES, the 20 − 35 GeV p T bin
> reaches about 5(7)% uncertainty, while the uncertainty drops to about 1.6(1.3)% for
> the 35 − 50 GeV bin and reaches about 0.9(0.9)% for the 100 − 150 GeV bin in the case
> of excluding (including) pre-recommendation JES and JER components.
>
> PDF page 47.

> 20 < p T < 35 0.929 0.950 0.0064 0.0119 0.0780 0.0730 0.0783 0.0739
>
> PDF page 48.

> The diagonal-region where both jets have p T between 20 and 35 GeV is excluded from
>
> PDF page 22.

> the measurement, as there are virtually no jets from the W -boson decay due to the
> kinematic restriction of the p T and the jet | η | requirements.
>
> PDF page 23.

> in the JES measurement, there are relatively large anti-correlations
> between s 1 and s 2 or s 3 . This is because the diagonal 20 − 35 GeV bin is not included in
> the measurement and consequently, s 1 is only estimated from the off-diagonal regions,
>
> PDF page 49.

The 7% half of that sentence matches the table: 0.0783 is 7.8% once the pre-recommendation components are included. The following bin is 0.0151, about 1.5%, against the “about 1.6(1.3)%” in the prose. Close enough not to be a separate comment. What the sentence does not say is that 0.929 ± 0.078 is less than 1σ from unity, (1 − 0.929) / 0.0783 ≈ 0.9. The Run 2 bins that actually pull away from 1 are the middle of the range: 0.971 ± 0.0109 (70–100 GeV) is about 2.7σ, and 0.976 ± 0.0093 (100–150 GeV) is about 2.6σ. The low-p_T point looks like a 7% correction because the diagonal region is empty and s_1 is constrained only off-diagonal, which the correlation paragraph already explains. Put that sentence in the Table 7.1 caption. Otherwise the figure will be quoted as a low-p_T scale problem that this fit has not established.

The same arithmetic should be applied to JER before any resolution correction is quoted. Every r_i in Table 7.2 is within 1σ of unity once the total uncertainty is used. The largest pull is Run 3, 50–70 GeV, 1.129 ± 0.177, about 0.7σ. The statistical errors are much smaller (0.02–0.08), so the central values differ from 1 at several statistical standard deviations, and the limitation is the systematic budget. Say that next to the table. The fit-validation paragraph already points the right way:

> The improvement is seen across
> the full W -mass distribution, even though only the mean of the distribution was fitted.
> In contrast, no such improvement is observed in Run 3, where the corrections are
> substantially smaller compared to the Run 2 corrections. No improvement is observed in
> the JER distributions either, which is consistent with the corresponding JER corrections
> being close to unity.
>
> PDF page 54.

That is a fair description of the plots. It should not be softened into “no improvement, therefore the simulation is fine” for JES in the Run 2 mid-p_T bins, where the post-fit shift is the result.

### 8. The correction cannot yet be applied

> The JES and JER corrections are derived in discrete p T bins, however a continuous
> correction function will be later constructed by interpolation across these bins, in order
> to apply the derived corrections.
>
> PDF page 47.

Assigning the discrete factor to a representative p_T rather than the bin centre is the right reason, given a steeply falling spectrum. The interpolation that would make the factor usable is deferred. For a chapter whose product is a calibration, the interpolation, the choice of knot, and the bias from interpolating six points belong in this chapter, not in a later note. A closure test is also not described in the extracted text: inject a known s_i, especially in the off-diagonal-only 20–35 GeV bin, and show that the fit returns it. The data/prediction comparison in §7.3 is necessary and is not that test.

### 9. Background and the standard in situ comparison are cited into missing sections

> This signature allows a clean event selection, with only a small contribution
> from background processes (described in Section sec:background).
>
> PDF page 2.

> only 5% of the
> selected simulated events in the Inclusive region originate from background processes,
> with the dominant contribution coming from single-top quark production (specifically
> tW associated production; see Section ?? for a detailed description of the considered
> backgrounds).
>
> PDF page 16.

Five percent background after the χ² < 1 requirement (Equation 4.1; the superscript is lost in the text extraction), dominated by tW, is a useful inclusive number. The composition, the p_T dependence, and the fake-lepton estimate are in Section ??, and the comparison with the standard ATLAS in situ methods is in Chapter ??. The low-p_T bin is where both the JES central value and the JER uncertainty are worst, so an inclusive 5% is not automatically the purity of that bin. Give the background fraction in each analysis region in this chapter, even if the generator-level description lives elsewhere.

## What is already in good shape

The chapter states a real gap and a concrete method. The hadronic W is not a new idea, and the text does not pretend it is:

> The use of hadronically decaying W boson for jet calibration was already proposed long
> before Run 1 [1]. Although this technique has never been included in the nominal JES
> calibration, it was used as a cross-check in the 7 TeV JES measurement, as described in
> Section 15 in [2].
>
> PDF page 1.

Forward folding is motivated by the absence of a reference object, the reco-to-truth match is specified (closest truth jet within ΔR = 0.2, unmatched if the match is ambiguous), and the response mode R is taken from a Gaussian fit to the peak rather than from the mean of a non-Gaussian response. That last choice is the right one for a scale factor that is supposed to move the mode.

The selection is not only asserted. After the χ² < 1 requirement the fraction of events in which both W jets are identified rises with p_T and is essentially complete in the two highest diagonal bins:

> The χ < 1 requirement significantly increases the fraction of events in which both
> jets from the hadronic W -boson decay were identified in a matchable event. This fraction
> increases with jet p T , reaching ≈ 100 % in the 100 − 150 GeV and 150 − 200 GeV
> diagonal regions.
>
> PDF page 24.

The Run 2 / Run 3 split is used as a check rather than as a second independent publication of the same number, and the text says the Run 3 factors sit closer to unity. Luminosities are on the figures (140 fb⁻¹ at 13 TeV, 52 fb⁻¹ at 13.6 TeV). The correlation paragraph explains why s_1 is anti-correlated with s_2 and s_3. Those are the parts a committee can defend. The comments above are about making the uncertainty, the interval, and the unresolved cross-references match that standard.

## Minor formal points

- “they total likelihood function” and “a particular combinations” in §6.2.
- “whose standard deviations corresponds” in §7.1.
- “The diagonal-region” should be “The diagonal region”.
- Running heads and the PDF page number are repeated as body text in the extraction. That is a conversion artefact, not an author error, but the source line numbers starting at 94 will confuse a reader of this file if it is circulated on its own. Add a title page that says which thesis chapter this is.
- Bibliography entries resolve as “cit. on p. 1” because this excerpt does not contain the pages the citations point to. Fine inside the full thesis. Misleading in this file.

## Questions for the defence

1. Why is the statistical uncertainty defined at half the maximum likelihood rather than at −2ΔlnL = 1?
2. Are the pseudo-experiments drawn from the Hessian covariance, or from an independent Gaussian per bin?
3. Which systematic component stands in for the in situ JER smearing that has not been derived for this reconstruction release, and how large is it in the 20–35 GeV bin?
4. What does a closure test return for an injected s_1, given that the 20–35 GeV diagonal region is excluded?
5. Confirm that the factor to be applied to data is 1/s, and show σ(1/s) for the Run 2 20–35 GeV bin.

No numerical grade is given. This file is not the whole thesis, and several sections the argument depends on are not in it.
