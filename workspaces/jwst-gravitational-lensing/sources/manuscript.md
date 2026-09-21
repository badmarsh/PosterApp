# Sub-Kiloparsec Dark Matter Substructure Imaging with JWST Strong Lensing

**Authors:** Alistair Vance, Elena Rostova, Marcus Thorne, Tariq Mansoor  
**Affiliation:** Kavli Institute for Particle Astrophysics and Cosmology & European Southern Observatory  
**Journal:** The Astrophysical Journal Letters (ApJL), 2026

## Abstract
Standard cold dark matter ($\Lambda\text{CDM}$) cosmology predicts an abundant population of low-mass subhalos ($M < 10^8 M_\odot$) orbiting massive galaxy cluster lenses. Because star formation is heavily suppressed below this mass scale, these primordial structures remain dark and can only be detected via their gravitational perturbation on magnified background arcs. Here we present a differentiable neural ray-tracing framework that inverts JWST NIRCam high-resolution multi-band mosaics (F115W, F200W, F444W) of the lensing cluster SMACS J0723.3-7327 ($z = 0.39$). By coupling a multi-resolution hash grid to a Poisson-consistent deflection solver ($\nabla^2 \psi = 2\kappa$), our method achieves a subhalo mass detection limit of $1.1 \times 10^7 M_\odot$ at $5.8\sigma$ significance with an astrometric resolution of $0.028''$. This represents a $7.7\times$ sensitivity gain over Hubble Space Telescope baselines, ruling out thermal relic warm dark matter candidates with particle masses $m_{\text{wdm}} < 9.4\text{ keV}$ at $95\%$ confidence.

## Methods
We formalize strong gravitational lensing as a forward inverse problem in continuous coordinate space. Light from background sources at redshift $z_s = 1.4 - 6.8$ is deflected by the cluster potential to image angles $\vec{\theta}$ through the lens equation:
$$\vec{\beta} = \vec{\theta} - \vec{\alpha}(\vec{\theta}) = \vec{\theta} - \frac{1}{\pi} \int_{\mathbb{R}^2} \kappa(\vec{\theta}') \frac{\vec{\theta} - \vec{\theta}'}{|\vec{\theta} - \vec{\theta}'|^2} \, d^2\theta'$$
where $\kappa(\vec{\theta}) \equiv \Sigma(\vec{\theta}) / \Sigma_{\text{crit}}$ is the dimensionless surface mass convergence and $\Sigma_{\text{crit}} = \frac{c^2 D_s}{4\pi G D_d D_{ds}}$ is the geometric critical surface mass density.

To decouple smooth cluster components from localized sub-kiloparsec clumps, the convergence field is decomposed into a macro-model and a neural substructure perturbation field:
$$\kappa(\vec{\theta}) = \kappa_{\text{macro}}(\vec{\theta}; \mathbf{w}_{\text{macro}}) + \delta\kappa_{\text{sub}}(\vec{\theta}; \mathbf{\phi})$$
The macro-model $\kappa_{\text{macro}}$ parameterizes elliptical pseudo-isothermal mass distributions (dPIEMD) for member galaxies and dual pseudo-isothermal elliptical potentials for dark matter halos. The perturbation $\delta\kappa_{\text{sub}}$ is parameterized via a 16-level multi-resolution hash grid with continuous trilinear interpolation.

We enforce Poisson consistency $\nabla^2 \psi = 2\kappa$ and the curl-free constraint $\nabla \times \vec{\alpha} \equiv 0$ through an exact spectral Green's function projection in Fourier space:
$$\vec{\alpha}_\phi(\vec{\theta}) = \nabla \left( \nabla^{-2} \left[ 2\kappa(\vec{\theta}) \right] \right)$$
The forward model predicts observed multi-band surface brightness $I_{\text{model}}(\vec{\theta})$ by ray-tracing the source light through the reconstructed deflection field and convolving with the empirical WebbPSF instrument kernel $\mathcal{P}(\vec{\theta})$:
$$I_{\text{model}}(\vec{\theta}) = \mathcal{P}(\vec{\theta}) \ast I_{\text{src}}(\vec{\theta} - \vec{\alpha}_\phi(\vec{\theta}))$$
Parameters are optimized end-to-end via AdamW using a regularized likelihood objective:
$$\mathcal{L}(\phi, I_{\text{src}}) = \frac{1}{2} \left\| I_{\text{obs}} - I_{\text{model}} \right\|_{\mathbf{C}_n^{-1}}^2 + \lambda_{\text{sub}} \mathcal{R}_{\text{sparse}}(\delta\kappa) + \gamma \|\nabla^2 \psi_{\text{macro}}\|_2^2$$
where $\mathbf{C}_n$ is the drizzled pixel noise covariance matrix and $\mathcal{R}_{\text{sparse}}(\delta\kappa) = \int \sqrt{|\delta\kappa|^2 + \epsilon^2} \, d^2\theta$ is a Charbonnier sparsity prior.

## Results
We evaluated our framework across 50 synthetic cluster injection-recovery simulations and applied it to the deep NIRCam imaging of cluster SMACS J0723.3-7327.
1. **Detection Threshold:** The pipeline achieves an unambiguous $5.8\sigma$ detection of a $(1.1 \pm 0.2) \times 10^7 M_\odot$ subhalo located at $\Delta\vec{\theta} = (+1.42'', -0.88'')$ relative to the brightest central galaxy of Arc 1. Bayes factor analysis yields $\ln \mathcal{B} = 18.4$ favoring the substructure model over smooth macro-potentials.
2. **Benchmark Comparisons:** Controlled benchmarking demonstrates superior performance against standard astrophysical tools:
   - Analytic NFW Profile: $1.4 \times 10^9 M_\odot$ limit, $0.180''$ astrometric error, 12.4 GPU-hours.
   - LENSTOOL v7.2: $3.8 \times 10^8 M_\odot$ limit, $0.095''$ astrometric error, 48.0 GPU-hours.
   - PyAutoLens v2.6: $8.5 \times 10^7 M_\odot$ limit, $0.052''$ astrometric error, 26.5 GPU-hours.
   - **NeuralLens (Ours):** **$1.1 \times 10^7 M_\odot$ limit**, **$0.028''$ astrometric error**, **$1.8$ GPU-hours** ($p = 2.4 \times 10^{-4}$).
3. **Cosmological Implications:** The inferred subhalo mass function slope is $\alpha = 1.89 \pm 0.08$ down to $10^7 M_\odot$, consistent with cold dark matter predictions ($dN/dM \propto M^{-1.9}$) and disfavoring sterile neutrino models with mass $m_s < 12\text{ keV}$.

## Limitations
1. Unresolved line-of-sight mass structures along the cosmic pencil beam can mimic genuine cluster subhalos; multi-plane redshift tomography is required to fully break this degeneracy.
2. Source morphology complexity: clumpiness in high-redshift lensed starburst galaxies can correlate with small-scale deflection fluctuations.
3. Micro-lensing from cluster intra-cluster light stars introduces high-frequency localized magnification fluctuations not modeled in our continuum approximation.
