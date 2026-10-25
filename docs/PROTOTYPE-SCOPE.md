# Prototype scope and social interaction framework

This is the assessment-facing scope of the current artefacts. Read alongside the [experience requirements](https://github.com/terserahdehh/DesignProposal---DECO3500/wiki/Experience-Requirements), [research](../research-findings/README.md) and [hardware guide](../hardware/README.md).

## Data and interaction flow

```mermaid
flowchart LR
    A[Wearer A: companion page] -->|Bluetooth setup and own phone location| B[Nayaka band]
    C[Wearer B: companion page] -->|Bluetooth setup and own phone location| D[Syifa band]
    B <-->|Direct ESP-NOW: paired messages and location| D
    B --> E[Approximate north-up bearing and distance]
    D --> F[Approximate north-up bearing and distance]
    G[Separate web simulator] --> H[Simulated larger group and movement]
```

Each wearer supplies a location from their own device. Two bands receiving one laptop's position cannot locate two independently moving people. Location expires after 60 seconds; no location history is saved in band flash. Prepared text is persistent. Browser identity and messages use local storage. Device names are demonstration labels, not authenticated accounts.

## Functionality boundaries

| Artefact / feature | Actual function | Limit or simulation |
| --- | --- | --- |
| Two physical bands | Bidirectional ESP-NOW messaging, sender identification and device acknowledgement | One configured Nayaka–Syifa pair; no demonstrated larger physical group |
| `/phone` companion | Edit text, connect a supported band, manually sync/read acknowledged presets, share device location | Supported browser and hardware required; no secure account identity |
| Image editor | Browser image creation, preview and storage; protocol support checks | Documented installed watches are text-only; do not infer physical image support from UI tests |
| Find Friend | Approximate bearing and metres from independent fresh coordinates; uncertainty gating | No onboard GPS, magnetometer, obstacle-aware route, indoor positioning or wrist-relative compass |
| SOS | Three confirmations, cancellation before sending, paired-friend alert | No staff integration, rescue service, read receipt or guaranteed delivery |
| Original `/` simulator | Interactive screens, selection, larger group and incoming state exploration | Direction, proximity, battery and group delivery are simulated |
| Browser connection panel | Real WebRTC peer messaging with manual invitation/reply | Network connectivity required; one peer; restrictive NAT may prevent connection |
| Automated tests | Interface state, protocol, acknowledgement, errors and WebRTC checks | Browser hardware doubles do not validate live radios, location accuracy or people |
| Physical usability session | Five participants' qualitative feedback on Find Friend | No reported task completion times, controlled accuracy benchmark or festival field validation |

## Applying a framework

Ellis et al. (1991) identify communication, collaboration and coordination as central groupware concerns. We use that perspective to interpret our own design:

| Social/mobile concept | PulseBand design consequence | Remaining question |
| --- | --- | --- |
| Communication | Name sender/recipient; acknowledge device receipt | Did the friend read and understand the update? |
| Coordination | Prepare messages with an intended action; retain agreed landmarks | Who waits, who moves, and how is agreement confirmed? |
| Collaboration | Both friends participate in reuniting and decide how to respond | How is coordination effort shared rather than assigned to one organiser? |
| Awareness | Show peer status and location quality with the cue | Does visible status encourage pressure to remain available? |
| Time and place | Friends may be separated while reading updates asynchronously | How quickly does a cue lose meaning when crowds move? |
| Location | Suppress a bearing when reported uncertainty dominates separation | Do people understand north up and the absence of routing? |

This explicit application is a present-day analytical explanation, not evidence that this exact table was produced in Week 8 or Week 9.

## Reference

Ellis, C. A., Gibbs, S. J., & Rein, G. (1991). Groupware: Some issues and experiences. *Communications of the ACM, 34*(1), 39–58. https://doi.org/10.1145/99977.99987
