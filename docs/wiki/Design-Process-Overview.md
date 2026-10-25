# Design Process Overview

**PulseBand · Team 16 · DECO3500**

**Explore the outcome:** [A2 poster](https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/promotional-materials/documents/pulseband-a2-poster.pdf) · [Brochure and videos](https://github.com/terserahdehh/DesignProposal---DECO3500/tree/main/promotional-materials) · [Promotional website](https://deco-3500-website-promo.vercel.app/).

**Try the prototype:** [Wearable simulator](https://pulseband-steel.vercel.app/) · [Physical-band companion](https://pulseband-steel.vercel.app/phone) · [Setup and deployment](https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/docs/DEVELOPMENT.md). No account or login is required. For a physical demonstration, use the configured Nayaka–Syifa pair and [quick-start instructions](https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/hardware/QUICK_START.md).

## Opportunity and research

PulseBand explores how friends can communicate changing plans and reconnect at concerts without repeatedly checking phones. We asked how social and mobile technology might support connection while respecting attention and the freedom to separate. Our outcome combines prepared wrist messages, approximate friend-finding and a deliberate peer SOS alert.

We combined a 27-response survey, five interviews, online observations and secondary research. Finding friends was the greatest difficulty for 13 respondents (48.1%), followed by communication for eight (29.6%). Ten preferred approximate direction or distance, and five wanted quick updates. These descriptive preferences prioritised features, but do not establish population demand or prototype effectiveness (Team 16, 2026d).

Interviews connected poor reception, inaudible calls, moving crowds and group coordination. Participants used landmarks and meeting points as workarounds. One reported that a location message could become obsolete before arriving (Team 16, 2026c, pp. 2–3). Communicating intentions under changing conditions became central. Convenience sampling, retrospective accounts and online examples limit generalisation.

Lindström and Pettersson (2010) identify ad-hoc re-planning and shareability as festival design challenges. This explains why a message should communicate an intended action, beyond a status. Larsen et al. (2013) used fixed Bluetooth scanners to study festival movement and grouping, while acknowledging discoverability bias. This contextualises reconnection, but does not establish PulseBand's radio range or positioning accuracy.

## Translating evidence into interaction

We narrowed the concept to Find Friend, quick messages and SOS. Prepared messages address inconvenient typing and loud environments. Names and text accompany colour so meaning does not depend on memorising lights. Message composition moved to a larger companion screen, leaving brief selection and confirmation on the wrist. This trades preparation effort for reduced interaction during the performance. Earlier explorations of lyrics, memory bookmarking and vibration did not become physical features.

Ellis et al.’s (1991) groupware perspective distinguishes communication, coordination and collaboration. Delivery communicates information, deciding who waits coordinates action, and reuniting depends on cooperation. Asynchronous updates may be read later, so acknowledgement means device receipt, not attention or agreement. An arrow supplies awareness but cannot negotiate a meeting plan.

Dagan et al.’s (2019) social-wearables framework asks who triggers an input, how intentional it is, and who perceives the output. PulseBand uses deliberate touch for messages and opt-in location updates. Visual outputs support brief awareness but may also be visible to bystanders. The framework therefore prompts attention to control, consent and display visibility. It focuses on co-located interaction. We apply its questions to temporary separation within a shared venue, without claiming equivalent evaluation results.

![Early wearable concept](https://github.com/terserahdehh/DesignProposal---DECO3500/raw/refs/heads/main/prototype/static/Initial%20Idea.png)

*Figure 1. Early concept artefact showing the breadth of exploration before the physical prototype focused on communication and reconnection.*

![Design framework for social wearables](https://github.com/terserahdehh/DesignProposal---DECO3500/raw/refs/heads/main/docs/assets/social-wearables-framework.png)

*Figure 2. Team-supplied framework image reproducing the input/intentionality and input/output matrices from Dagan et al. (2019, p. 1005, Figures 1–2). Original figure and icon credits remain visible. Copyright 2019 by the authors, with publication rights licensed to ACM. These are prior-work matrices, not PulseBand evaluation results.*

## Prototyping and early evaluation

The early browser prototype simulated messages, location and group connection. Nayaka, Amy, Serafina and Syifa collected concept feedback through demonstrations and scenario walkthroughs (Team 16, 2026a). Participants valued prepared messages and customisation but needed explanations of controls, colours and recipients. “Taking a break” was ambiguous: it could invite company or request privacy. Others wanted permission before being found and warned that exact-looking distances implied excessive accuracy.

These findings supported a short menu, identifiable senders and recipients, editable messages and explicit delivery states. Three separate OK presses make SOS deliberate, with cancellation before sending. However, this adds effort under stress and has not been validated as an accessible emergency interaction. Dedicated replies and permission for each Find Friend request remain unimplemented. Turchet et al. (2021) informed our interest in personalised tactile feedback. Their different musical-haptics context does not validate our communication design, and our boards have no vibration motor.

## From simulation to a physical pair

Our retrospective Week 9 record reports tutor concern that friend-finding remained simulated. We prioritised two ESP32 touch-display bands. Bluetooth connects the companion for configuration, while ESP-NOW exchanges messages between the Nayaka–Syifa pair. Prepared text persists on each band. Larger groups remain simulated. The companion stores image presets, but the documented installed watches remain text-only.

The boards have neither GPS nor a compass. Independent phone locations supply approximate distance and a north-referenced bearing that does not rotate with the wrist. Stale or insufficiently separated fixes suppress direction. This exposes uncertainty, but provides no indoor positioning, safe route or metre-level movement tracking. Messaging avoids mobile data dependence, while guidance still depends on phone location quality.

![Current companion interface](https://github.com/terserahdehh/DesignProposal---DECO3500/raw/refs/heads/main/docs/assets/companion-interface.png)

*Figure 3. Companion interface captured from the production website on 25 October 2026, before connecting hardware. This shows message preparation and transport selection. It is not a live hardware or location test.*

## Physical evaluation and learning

Five participants subsequently tried Find Friend using two physical bands (Team 16, 2026b). Their discussion identified useful direction cues, inconsistent guidance during sideways movement, subtle brightness changes and unclear proximity dots. The transcript supports these qualitative findings, but records no controlled task times, success rates or accuracy measurements. It cannot establish festival reliability. Participant labels belong to this session and are not assumed to match the interview sample.

We therefore prioritised clearer directional meaning, stronger proximity feedback and fewer competing indicators. Faster blinking and removing dots are recorded as proposed refinements, not universally verified implementation. Engineering safeguards address stale locations and acknowledgement errors, while automated browser tests check interface and protocol behaviour. Neither substitutes for user evaluation. The next study should compare cue interpretations with independent location sources, observe safe movement, and assess visibility, comfort, refusal and message ambiguity with more diverse attendees.

## Exhibition

The supplied photographs document the exhibit display: poster, brochures, promotional website, companion interface and two physical boards. This brought the research narrative and interactive artefacts together for visitors. The group photograph adds visual context to the team-reported Week 12 participation. These images document the exhibit, without supplying task-success measurements or a record of the oral pitch.

![PulseBand exhibition setup](https://github.com/terserahdehh/DesignProposal---DECO3500/raw/refs/heads/main/promotional-materials/exhibition/exhibit-setup.png)

*Figure 4. Team-supplied screenshot of the exhibition setup, showing the poster, brochures, promotional website, companion interface and two boards.*

![Group at the PulseBand exhibition](https://github.com/terserahdehh/DesignProposal---DECO3500/raw/refs/heads/main/promotional-materials/exhibition/exhibit-group.png)

*Figure 5. Team-supplied exhibition group photograph showing the display and people gathered around the demonstration table.*

## Contributions and critical reflection

All four members contributed research and synthesis. Amy (Nguyen Minh Thao Vy) conducted Interviews 1–2 and scenario evaluation, created the brochure and video, and revised content and poster. Serafina conducted Interview 3 and early testing, co-created the website and poster, edited video and assisted coding/hardware. Syifa conducted Interview 5 and an early walkthrough, co-created the website/poster and assisted coding/hardware. Nayaka conducted Interview 4 and early testing, and led coding, hardware integration and deployment. Coordination used WhatsApp and class discussions.

Technical connection and social coordination are different achievements. A credible demonstration exposes uncertainty and leaves room to decline. Ethical Considerations applies this to privacy, accessibility, peer alerts and publication. Our documented cycle follows the course brief (The University of Queensland, 2026), with remaining limitations and historical evidence gaps stated explicitly.

## References

Dagan, E., Márquez Segura, E., Altarriba Bertran, F., Flores, M., Mitchell, R., & Isbister, K. (2019). Design framework for social wearables. In *Proceedings of the 2019 on Designing Interactive Systems Conference* (pp. 1001–1015). Association for Computing Machinery. https://doi.org/10.1145/3322276.3322291

Ellis, C. A., Gibbs, S. J., & Rein, G. (1991). Groupware: Some issues and experiences. *Communications of the ACM, 34*(1), 39–58. https://doi.org/10.1145/99977.99987

Larsen, J. E., Sapiezynski, P., Stopczynski, A., Mørup, M., & Theodorsen, R. (2013). *Crowds, Bluetooth, and rock-n-roll: Understanding music festival participant behavior* [Preprint]. arXiv. https://doi.org/10.48550/arXiv.1306.3133

Lindström, S., & Pettersson, M. (2010). Supporting ad-hoc re-planning and shareability at large-scale events. In *Proceedings of the 16th ACM International Conference on Supporting Group Work* (pp. 245–252). Association for Computing Machinery. https://doi.org/10.1145/1880071.1880113

Team 16. (2026a). *Early prototype evaluations* [Research index]. https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/research-findings/README.md

Team 16. (2026b). *Friend-finding usability testing* [Transcript and summary]. https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/research-findings/team/usability-testing-summary.md

Team 16. (2026c). *Interview transcripts* [Five research interviews]. https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/research-findings/interview-transcripts.pdf

Team 16. (2026d). *Survey results* [Aggregate data and synthesis]. https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/research-findings/team/README.md#survey-results

The University of Queensland. (2026). *Assignment 3: Design project (sequence)* [DECO3500 Social & Mobile Computing course assignment brief, Semester 2].

Turchet, L., West, T., & Wanderley, M. M. (2021). Touching the audience: Musical haptic wearables for augmented and participatory live music performances. *Personal and Ubiquitous Computing, 25*(4), 749–769. https://doi.org/10.1007/s00779-020-01395-2
