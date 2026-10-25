# Ethical Considerations

**PulseBand · Team 16 · DECO3500**

## Purpose and framework

We want PulseBand to help friends stay connected without making anyone feel they have to be tracked. The design also needs to be clear about its limits: an approximate arrow is not a safe walking route, and an SOS to a friend does not contact emergency services.

For this analysis, we use the **Ethical Disclaimer** tool (Ethics for Designers, n.d.). Its five steps consider the current situation, stakeholders, intentions, unethical situations and the responsibilities designers accept. The sections below apply those steps to our own prototype, rather than treating a disclaimer as permission to transfer harm to users.

Loke and Matthews' (2020) *Scaffolding of Interaction Design Education Towards Ethical Design Thinking* treats ethics and values as part of interaction design education. Its [published abstract](https://doi.org/10.1007/978-981-15-5780-4_8) supports integrating value-sensitive reflection into design. We use the Ethical Disclaimer to structure our analysis of stakeholders, risks and design responsibilities.

## 1. Current situation

Friends at loud, crowded events coordinate using gestures, group chats, landmarks and agreed checkpoints. Interviewees describe delayed messages, difficulty hearing calls and uneven coordination responsibilities. Separation may be intentional and enjoyable. Constant physical togetherness is not the design goal. The wearable is optional support for occasional communication and reconnection.

The implemented hardware is one fixed two-band pair. Phone location is required for guidance. The boards have no GPS, magnetometer or vibration motor. Location can be inaccurate or suspended by the browser. Messages need powered bands within ESP-NOW range. These conditions affect what a wearer may reasonably trust.

## 2. Who could be affected

*Table 1. Stakeholders, benefits and potential harms.*

| Stakeholder | Benefit or interest | Potential burden or harm |
| --- | --- | --- |
| Wearer sending messages or location | Fast communication and reconnection | Loss of privacy, setup burden, misleading delivery or guidance |
| Friend receiving a signal | Awareness and ability to coordinate | Ambiguous intentions, pressure to respond, anxiety from false alerts |
| Attendees with different sensory/motor needs | Alternative visual/tactile channels | Unreadable colours, small controls, uncomfortable vibration or inaccessible gestures |
| Other attendees and bystanders | Less phone obstruction | Collisions or disruption from screen-focused movement |
| Venue staff and emergency responders | Clear escalation expectations | Assumed responsibility for an alert they never receive |
| Research participants | Influence the design voluntarily | Exposure of identity, recordings or sensitive disclosures |
| Team, teaching staff and future maintainers | Understandable evidence and implementation | Unsupported claims, exposed keys or incomplete evidence |
| Venue operators and the environment | Reusable optional devices | Cost, maintenance, battery handling and electronic waste |

## 3. What we want the design to support

Our aim is to keep messages quick, make location uncertainty visible and let people choose when to share. Typing happens on the companion page so the wrist interaction can stay short. People should be able to take a break or do something separately without feeling they are letting the group down.

Our prototype should let visitors distinguish demonstration effects from real communication. Device acknowledgement must not be described as a wearer reading or agreeing with a message. Neither simulated nor physical SOS should imply staff or emergency-service integration.

## 4. Risks and design responses

**Location privacy.** Finding friends should not turn into an expectation that everyone stays trackable. Users can start and stop sharing through the companion page. The watch does not yet let someone accept or refuse each finding request.

Dagan et al. (2019) ask who activates a wearable and who perceives its output. Applied here, intentional permission to start sharing does not authorise every later finding request, and a wrist display may still be visible to bystanders. Lindström and Pettersson (2010) also identify control over shared group information as a design concern. Our future group controls should therefore support selective sharing and refusal, rather than assume friendship establishes permanent permission.

**Misleading direction.** An arrow can look trustworthy even when the phone location is inaccurate. The band hides direction when the location is too old or uncertain, but it cannot show a safe route around barriers or through a crowd.

**Misunderstood messages.** A message reaching the band does not mean the person has read it or agreed to act. Friends may still need to confirm whether they will wait, move or meet somewhere else.

**SOS expectations.** Three OK presses help avoid accidental alerts, but could be difficult when someone is stressed. SOS only alerts the paired friend. It does not contact venue staff or emergency services.

**Accessibility and attention.** Small controls, colours and screen brightness may work differently for different users. The interface includes text alongside colour, but the physical prototype has no vibration motor. People also need to stay aware of the crowd rather than keep watching the display while walking.

**Personal data.** Research documents, location information and connection details can reveal more about someone than intended. Public documents need careful handling, and private credentials do not belong in the repository.

**Comfort and reuse.** A wearable needs to be comfortable and affordable enough for people to use. Loaning or reusing devices could reduce cost and waste, but these arrangements are outside our prototype.

## 5. Responsibilities and boundaries

**Our responsibility as a team** is to explain what works, make errors understandable and give users control over sharing and cancellation. We also need to describe our tests accurately and protect participant information. The technical limits matter because people may act on what the screen tells them.

**Shared responsibilities** include agreeing a checkpoint and interpreting a message together. Users should be able to decide whether to move, wait or decline. Venue staff retain their existing roles. A peer alert does not delegate a response to them. We should design clear expectations rather than shift every burden to a main group organiser.

**Some conditions are outside our control**, including phone location accuracy, radio interference, the browser pausing updates and barriers at the venue. The interface needs to make problems visible so friends can fall back on a meeting point or another way to contact each other.

## Location and stored data

Location sharing starts when the user chooses it on the companion page. Each wearer needs to share their own phone's location. The band stops using a location after 60 seconds without an update.

Stopping sharing ends new updates and asks the band to clear its location. If the connection fails, the previous location may remain until it expires. Location is not saved permanently on the band. Prepared messages are saved so they remain available after restarting it.

The web prototype also remembers the selected identity and message lists in the browser. These names are demonstration labels, not secure accounts. A finished product would need stronger account and group privacy controls.

Larsen et al. (2013) inferred festival movement and grouping from time-stamped Bluetooth observations. This demonstrates the analytical value of repeated location-related records, while also motivating our decision to avoid retaining a location history. Their study's historical consent arrangements do not establish permission for our own collection or publication. Our ethics assessment concerns what PulseBand users choose to share and what our team publishes.

## Research and public documentation

The source interviews include consent to recording and university-project use, but that does not by itself establish consent to identifiable public publication. This wiki uses participant codes and summarises findings. The [combined interview PDF](https://github.com/terserahdehh/DesignProposal---DECO3500/blob/main/research-findings/interview-transcripts.pdf) and retained evaluation document contain participant details, so publication raises privacy and consent considerations beyond participation in the study. Recordings, precise test locations, private credentials and raw Bluetooth/session logs should not be included in public artefacts.

For further evaluation, explain purpose, procedures, recording, data access and withdrawal before obtaining consent. Use a safe setting, comfortable sound levels and voluntary sharing. A participant should be able to decline location or SOS tasks without penalty. Store raw notes within the agreed access scope. Publish de-identified results and clearly state limitations. Avoid portraying one person's sensory preferences as representative of a whole community.

## Priorities and evidence needed

The following priorities are our design judgement, not measured risk probabilities. Existing controls reduce particular risks. No row implies the remaining risk has been eliminated.

*Table 2. Ethical priorities, current controls and remaining responsibilities.*

| Risk and priority | Current response | Remaining responsibility and acceptance evidence |
| --- | --- | --- |
| Coercive tracking (high) | Sharing starts and stops on the companion. Fixes expire. | Per-request refusal on the watch is absent. Team must evaluate whether a wearer can decline without social pressure. Do not describe browser permission as ongoing social consent. |
| Misleading guidance (high) | Stale/uncertain fixes suppress the arrow. North reference is explained. | Team must test whether unfamiliar users recognise uncertainty and avoid treating an arrow as a safe route. Retain agreed meeting points as a fallback. |
| False confidence in SOS (high) | Three confirmations, cancellation before sending, peer-only destination. | Test confirmation effort and recipient interpretation under safe simulated stress. Do not advertise an emergency response guarantee. |
| Public research exposure (high) | Wiki summaries use participant labels. | Team must review identifiable source documents and faces/voices in videos, and verify permission for public publication. Recording consent alone is insufficient. Public Git history may retain earlier versions. |
| Exclusion through colour or touch (medium) | Names and text supplement colour. Menu remains short. | Observe low-vision, colour-vision and motor-access needs with consenting participants. Physical vibration is absent, so do not claim an evaluated haptic or universally accessible experience. |
| Notification burden and ambiguous intentions (medium) | Editable messages and sender identity provide context. | Test mutually understood messages and the ability to ignore or decline. Dedicated replies remain future work. |
| Comfort, cost and waste (medium) | Prototype can be reused for demonstrations. | Team must evaluate fit, safe handling, cleaning, maintenance and eventual disposal before wider deployment. No lifecycle or affordability study has been completed. |

## Evaluation and accountability

Before a further study, explain which functions are real and which are simulated, who can access recordings, whether any material will be public, and how a participant can stop or withdraw within the agreed study procedure. Separate participation, recording and public-release choices. Do not require location sharing to participate in interface testing. A stationary, supervised task can assess interpretation without asking people to follow uncertain cues through a crowd.

For each task, record the consent conditions, observed misunderstanding, control used and unresolved consequence. Useful acceptance evidence would show a wearer stopping sharing, both friends interpreting an acknowledgement correctly, and a visitor identifying SOS as a peer alert. These are proposed criteria for the next evaluation, not outcomes already demonstrated with participants. All four team members share responsibility for reviewing public evidence and explaining limits at the exhibit. Coding ownership does not transfer that obligation to one person.

This assessment is a living design document. The move from simulation to phone-derived location made privacy, uncertainty and device acknowledgement more concrete. Adding larger groups, account identity, venue integration or stronger location technology would require another stakeholder and data-flow review. Loke and Matthews (2020) provide the broader educational argument for making values explicit throughout design. Our particular controls and priorities are our application to PulseBand.

## References

Dagan, E., Márquez Segura, E., Altarriba Bertran, F., Flores, M., Mitchell, R., & Isbister, K. (2019). Design framework for social wearables. In *Proceedings of the 2019 on Designing Interactive Systems Conference* (pp. 1001–1015). Association for Computing Machinery. https://doi.org/10.1145/3322276.3322291

Ethics for Designers. (n.d.). *Ethical disclaimer*. https://www.ethicsfordesigners.com/ethical-disclaimer

Larsen, J. E., Sapiezynski, P., Stopczynski, A., Mørup, M., & Theodorsen, R. (2013). *Crowds, Bluetooth, and rock-n-roll: Understanding music festival participant behavior* [Preprint]. arXiv. https://doi.org/10.48550/arXiv.1306.3133

Lindström, S., & Pettersson, M. (2010). Supporting ad-hoc re-planning and shareability at large-scale events. In *Proceedings of the 16th ACM International Conference on Supporting Group Work* (pp. 245–252). Association for Computing Machinery. https://doi.org/10.1145/1880071.1880113

Loke, L., & Matthews, B. (2020). Scaffolding of interaction design education towards ethical design thinking. In G. Melles (Ed.), *Design thinking in higher education: Interdisciplinary encounters* (pp. 165–181). Springer. https://doi.org/10.1007/978-981-15-5780-4_8
