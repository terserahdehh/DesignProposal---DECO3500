# Design Process Overview

**PulseBand · Team 16 · DECO3500**

**Explore the outcome:** [A2 poster](https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/promotional-materials/documents/pulseband-a2-poster.pdf) · [Brochure and videos](https://github.com/terserahdehh/DesignProposal---DECO3500/tree/main/promotional-materials) · [Promotional website](https://deco-3500-website-promo.vercel.app/).

**Try the prototype:** [Wearable simulator](https://pulseband-steel.vercel.app/) · [Physical-band companion](https://pulseband-steel.vercel.app/phone) · [Setup and deployment](https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/docs/DEVELOPMENT.md). No account or login is required. For a physical demonstration, use the configured Nayaka–Syifa pair and [quick-start instructions](https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/hardware/QUICK_START.md).

## Opportunity and research

PulseBand explores how friends can communicate changing plans and reconnect at concerts without repeatedly leaving the performance to check phones. We asked how social and mobile technology might support connection while respecting attention and the freedom to separate. Our outcome combines prepared wrist messages, approximate friend-finding and a deliberate peer SOS alert. The opportunity is shared awareness within an existing friendship, rather than continuous surveillance or replacing venue support.

We combined a 27-response survey, five interviews, online observations and secondary research. Thirteen survey respondents selected finding or reuniting with friends as their greatest difficulty (48.1%); eight selected communication (29.6%). Ten preferred approximate direction or distance, and five wanted quick updates. These descriptive results helped prioritise features; they do not establish population demand or prototype effectiveness (Team 16, 2026d).

Interview synthesis connected poor reception, inaudible calls, moving crowds and the effort of coordinating groups. Participants described landmarks and agreed meeting points as workarounds. One reported that a location message could become obsolete before arriving (Team 16, 2026c, pp. 2–3). Across sources, the important need was communicating intentions under changing conditions. Our convenience sample and retrospective accounts limit generalisation; online posts provide contextual examples rather than representative evidence.

## Translating evidence into interaction

We narrowed the concept to Find Friend, quick messages and SOS. Prepared messages address inconvenient typing and loud environments; names and text accompany colour so meaning does not depend on memorising lights. Message composition moved to a larger companion screen, leaving brief selection and confirmation on the wrist. This trades preparation effort for reduced interaction during the performance. Earlier explorations of lyrics, memory bookmarking and vibration did not become physical features.

The design uses Ellis et al.’s (1991) groupware perspective to distinguish communication, coordination and collaboration. A delivered message communicates information; deciding who waits coordinates action; successfully reuniting depends on both friends cooperating. PulseBand supports nearby interaction between separated people, with asynchronous updates that may be read later. Consequently, acknowledgement must mean device receipt, not attention or agreement. A direction cue supplies awareness but cannot negotiate a meeting plan.

![Early wearable concept](https://github.com/terserahdehh/DesignProposal---DECO3500/raw/refs/heads/main/prototype/static/Initial%20Idea.png)

*Figure 1. Early concept artefact showing the breadth of exploration before the physical prototype focused on communication and reconnection.*

## Prototyping and early evaluation

The early browser prototype simulated messages, location and group connection. Nayaka, Amy, Serafina and Syifa collected concept feedback through demonstrations and scenario walkthroughs (Team 16, 2026a). Participants valued prepared messages and customisation but needed explanations of controls, colours and recipients. “Taking a break” was ambiguous: it could invite company or request privacy. Others wanted permission before being found and warned that exact-looking distances implied excessive accuracy.

These findings supported a short menu, identifiable senders and recipients, editable messages and explicit delivery states. Three separate OK presses make SOS deliberate, with cancellation before sending. However, this adds effort under stress and has not been validated as an accessible emergency interaction. Dedicated replies and permission for each Find Friend request remain unimplemented. Turchet et al. (2021) informed our interest in personalised tactile feedback; their different musical-haptics context does not validate our communication design, and our boards have no vibration motor.

## From simulation to a physical pair

Our retrospective Week 9 record reports tutor concern that friend-finding remained simulated. We responded by prioritising two ESP32 touch-display bands. Bluetooth connects the companion page for configuration; ESP-NOW exchanges messages directly between the configured Nayaka–Syifa pair. Prepared text persists on each band. The web simulator separately demonstrates larger groups; that is not evidence of multi-band routing. The companion editor can store image presets, but the documented installed watches remain text-only.

Location exposed a major trade-off. The boards have neither GPS nor a compass, so each wearer must supply an independent phone location. The display calculates approximate distance and a north-referenced bearing; it does not rotate with the wrist. Expired or insufficiently separated location fixes suppress direction. This makes uncertainty consequential in the interface, but cannot provide indoor positioning, a safe route or metre-level movement tracking. Direct messaging avoids mobile data dependence; usable guidance still depends on phone location quality.

## Physical evaluation and learning

Five participants subsequently tried Find Friend using two physical bands (Team 16, 2026b). Their discussion identified useful direction cues, inconsistent guidance during sideways movement, subtle brightness changes and unclear proximity dots. The transcript supports these qualitative findings, but records no controlled task times, success rates or accuracy measurements. It cannot establish festival reliability. Participant labels belong to this session and are not assumed to match the interview sample.

We therefore prioritised clearer directional meaning, stronger proximity feedback and fewer competing indicators. Faster blinking and removing dots are recorded as proposed refinements, not universally verified implementation. Engineering safeguards address stale locations and acknowledgement errors, while automated browser tests check interface and protocol behaviour; neither substitutes for user evaluation. The next study should compare cue interpretations with independent location sources, observe safe movement, and assess visibility, comfort, refusal and message ambiguity with more diverse attendees.

## Contributions and critical reflection

All four members contributed research and synthesis. Amy (Nguyen Minh Thao Vy) conducted Interviews 1–2 and scenario evaluation, created the brochure and video, and revised content and poster. Serafina conducted Interview 3 and early testing, co-created the website and poster, edited video and assisted coding/hardware. Syifa conducted Interview 5 and an early walkthrough, co-created the website/poster and assisted coding/hardware. Nayaka conducted Interview 4 and early testing, and led coding, hardware integration and deployment. Coordination used WhatsApp and class discussions.

Our central learning is that technical connection and social coordination are different achievements. A credible demonstration must expose uncertainty and leave room to decline. The dedicated Ethical Considerations page applies this lesson to privacy, accessibility, peer alerts and research publication. Remaining limitations and gaps in historical meeting evidence are documented rather than reconstructed as completed work.

## References

Ellis, C. A., Gibbs, S. J., & Rein, G. (1991). Groupware: Some issues and experiences. *Communications of the ACM, 34*(1), 39–58. https://doi.org/10.1145/99977.99987

Team 16. (2026a). *Early prototype evaluations* [Research index]. https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/research-findings/README.md

Team 16. (2026b). *Friend-finding usability testing* [Transcript and summary]. https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/research-findings/team/usability-testing-summary.md

Team 16. (2026c). *Interview transcripts* [Five research interviews]. https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/research-findings/interview-transcripts.pdf

Team 16. (2026d). *Survey results* [Aggregate data and synthesis]. https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/research-findings/team/README.md#survey-results

Turchet, L., West, T., & Wanderley, M. M. (2021). Touching the audience: Musical haptic wearables for augmented and participatory live music performances. *Personal and Ubiquitous Computing, 25*(4), 749–769. https://doi.org/10.1007/s00779-020-01395-2
