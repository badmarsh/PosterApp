Eye diagram of the uplinks

![](images/e192b7791bbc10f2ee03600743948c1b4592eedad9a5c082c2211716d88df566.jpg)

# Operations and Performance of the ATLAS Tile Calorimeter Phase-II Upgrade Demonstrator in Run 3 Fernando Carrió Argos\* on behalf of ATLAS Tile Calorimeter system \*Instituto de Física Corpuscular (CSIC-UV)

## Central part of the ATLAS hadronic calorimeter

☐ Measurement of jet energies, hadronically decaying $\tau$ leptons and missing transverse energy

☐ Sampling calorimeter made of steel plates and plastic scintillator tiles

☐ Covers the central region $|\eta|<1.7$

## ATLAS Tile Calorimeter and Phase-II upgrade

☐ Dynamic range from \~10 MeV to \~2 TeV per calorimeter cell

The High Luminosity Large Hadron Collider (HL-LHC) aims to increase the instantaneous luminosity of the LHC by a factor 5–7.5 beyond its nominal design value, starting around 2030. The resulting increase in pile-up will require a new Trigger and Data Acquisition (TDAQ) architecture capable of handling fully digital and full-granularity calorimeter information. As part of the ATLAS Phase-II Upgrade, the Tile Calorimeter (TileCal) will undergo a major replacement of both its on-detector and off-detector electronics.

☐ About 10,000 photomultipliers (PMTs) in total

![](images/2b729e17cc7c452ae0cf0ac62504766757cebc56c61c0e2177c24a010fcde8c4.jpg)  
Tile Barrel Tile Extended Barrel

![](images/d8caa1e3faa7521c7abb1cf0f9f3cabc37a87a52b2a4e57a6d6971219bb505fc.jpg)  
HL-LHC architecture (2030-2041) [1]

## TileCal Phase-II upgrade electronics and the Demonstrator

![](images/14881f80fbf8b433380f77207be5f1c14d642892c699f354773943cd24dd6d72.jpg)  
1792 x Low Voltage power supply bricks
☐ 200V → 10V

## On-detector

896 x MainBoards

\- Control and configuration
- FENICS signal digitization
- 2 x 12-bit ADCs @ 40 Msps
- 1 x 16-bit ADC for integrator

![](images/01d8254c84eb32321955073d9536b0903f4f1799c664a5f4a2372a6f9045af55.jpg)

## 9852 x FENICS cards ←

☐ PMT pulse shaping with bi-gain amplification (1:40)

☐ Current integrator for luminosity measurements and Cs calibration

measurements and Cs calibration (Demonstrator version with 1:32 gain ratio and analog trigger outputs)

![](images/5deb3cb8b0611f6f46c096abb2cc93bcdd668cb913eaf30718fac6552d2d3373.jpg)

![](images/dd3d0bb69e0ccea2c0fe9c6dbd92496d3cc8e81c6a83f0d31b82d9d4f2e4df07.jpg)  
896 x DaughterBoards
☐ Clock and configuration distribution
☐ Transmission of detector data  
\~1000 x new PMTs
□ Hamamatsu R11187
□ Quantum Efficiency > 15%

![](images/e0e7ed226b99de66855ccbfafa60a896260b3d003aa2176f96e184a53af97a01.jpg)  
896 x High Voltage (HV) distribution board
9852 x HV Active Dividers
☐ Better PMT linearity at high current

![](images/7e9037c84405cf48b891931d87241056cce8442be71ce96f9ac75fd7c75a5129.jpg)

![](images/5cb2574808c9685c3a1b1ad5f97d59f12c6a4c89e545e4e18ba3be543ac40fef.jpg)  
256 x HV remote and power supply boards
☐ Provide individual control, monitoring and regulation per PMT

![](images/ca6e1c6f39b35178b0ca24867cc7c115a22390afe939d4c4d3ad8c57171e0e21.jpg)

☐ Data acquisition and energy reconstruction @ LHC bunch crossing frequency

☐ Distribution of the LHC clock to the on-detector electronics

☐ Interface with the ATLAS readout (1 MHz) and trigger systems (40 MHz)

## Clock and readout architecture of the Demonstrator

☐ Validation of the HL-LHC clock and readout architecture, and Phase-II electronics

☐ Installed during Long Shutdown 2 (2019-2022) and operated throughout Run 3 (2022-2026)

☐ Equipped with the latest TileCal Phase-II upgrade electronics

☐ Backward-compatible with the current ATLAS Trigger, Data Acquisition and Detector Control systems

☐ In the off-detector, the Compact Processing Module interfaces upgrade and legacy systems

Front-End Link eXchange  
![](images/07de78029113e3c18930e0debd15f291de0fc64bd66ea62ed41bf32b76f5d916.jpg)  
Frequency spectrum of channel 17

![](images/fb208c755d5e4c6167122336b632ed030b307f59dfdc845a86ee64ea8ea03b70.jpg)  
Clock and configuration
Monitoring and detector data

![](images/1040431b86c59cd50b6f746ffaa05b708a778a2ebb7e27e9abcee0a8b3ff8570.jpg)

![](images/34155de5628f0980a2ca6907d11142704621a90fb5c0aebdba237e5a82881e50.jpg)  
Compact Processing Module

![](images/ad2eacec17dc452059e39f8610caea173243dac5de2c31fd3413b90b9bfa5fae.jpg)  
☐ Data acquisition, processing and storing in memories

![](images/05aafc81bb4bad5f9d5f9b06ab1dac8370589feca998b6dc318bdb5febf95dad.jpg)

![](images/1c9351114bb59f987e032fe64b0259263634ef77943b815422e497e0d7137342.jpg)  
L1-triggered events ReadOut Driver (7 x 10-bit samples, 1 gain)

☐ FELIX-based clock, trigger and configuration distribution to the on-detector electronics

☐ Receiving and storing detector data in off-detector pipeline memories at the LHC frequency

☐ Transmission of Level-1 triggered data to legacy TileCal DAQ system

☐ Certification with standalone software tools for data integrity and system stability studies

☐ Commissioning in ATLAS through laser and Charge Injection calibration runs

## Results and summary of the Demonstrator program in Run 3

The Demonstrator has operated successfully inside ATLAS during Run 3, validating the upgraded readout architecture under real detector conditions. The system demonstrates stable timing, calibration and physics performance, while providing essential operational feedback for the final HL-LHC TileCal electronics.

![](images/6f2364df845d6f94f32e07176568c30f0900019e4c47e88895529efac30aab00.jpg)  
Assembly in building 175 at CERN

![](images/0ef250df2f8d269d6b181a12cb48c5bbfdd6ed4095132177418d28abb67650bd.jpg)  
Maintenance in the ATLAS experiment

![](images/375ef6e768fc072c6116e332d6a4715ee03203c9a3ea45a0957f59499c5824ec.jpg)  
Extracted Demonstrator module during maintenance

![](images/56e4973264194ceb1094a7af6b487fa0223c4ca8d11d127c1d75bffb81cb8f2b.jpg)  
$E_{mean}$ [GeV]  
Time resolution measured with 2025 laser calibration data in the Long Barrel A partition. [1]

![](images/1a34de4f406b12698237896e5a3a809ad01d55f05b6b98128fac8b41d9aafa4d.jpg)  
Average relative response variation measured in individual TileCal layers in the Demonstrator and a neighbouring legacy module during 2024 [1]