# PulseBand exhibit pitch and visitor demonstration

Prepared on 25 October 2026 as a reusable script. This is preparation material, not evidence that an assessed pitch or exhibit took place.

## Two-to-three-minute pitch

Imagine your friend leaves a festival crowd to get water. The crowd shifts, the music is too loud for a call, and their message arrives after you have moved. You spend part of the performance searching rather than enjoying it together.

We are Team 16, and PulseBand explores a wearable way to communicate changing plans and reconnect with friends. Our survey had 27 responses: 13 people identified finding friends as their biggest difficulty and eight identified communication. Five interviews added examples of delayed messages, landmarks and agreed meeting points. That led us to focus on brief interactions, rather than another screen demanding constant attention.

Before the event, you prepare your own messages on a companion page. On the wrist, you choose a short update and confirm it. The other band shows who sent it. Device acknowledgement tells us the band received it; it does not tell us the person read it or agreed to meet.

Here are our two physical ESP32 bands. They exchange messages directly using ESP-NOW, while Bluetooth connects a band to the companion page for setup. Please try sending a message to your partner. You can cancel before confirming. The original browser simulator also explores a larger friend group, but our physical build is one configured pair.

Find Friend uses each wearer's independently shared phone location to estimate direction and distance. Its arrow is north up, not a wrist compass or walking route. If locations are stale or too uncertain, the arrow is hidden. You still choose a safe route and can use an agreed landmark. SOS requires three OK presses and alerts the paired friend; it does not contact staff or emergency services.

Five people tested Find Friend with the physical bands. They valued the arrow but reported inconsistent sideways guidance, subtle brightness changes and confusing proximity dots. This taught us that fewer indicators with clearer meaning may help more than adding features. Stronger proximity cues and permission for each finding request remain priorities for further work.

PulseBand's contribution is an exploration of social awareness under noisy, changing conditions. It helps friends exchange intentions while making the limits of location, delivery and consent visible. Try the controls and tell us what you think your partner should do after receiving your message.

## Visitor flow

1. Open the [companion](https://pulseband-steel.vercel.app/phone) in supported Chrome and follow [hardware setup](../hardware/QUICK_START.md). No account is required. Do not overwrite existing presets without the wearer's agreement.
2. Give each visitor a role: sender and receiver. Let them use Back, Next and OK without guiding every press. Observe confusion before explaining.
3. Have them send one prepared message, interpret the incoming message and discuss whether to move, wait or decline.
4. For Find Friend, use independent phone locations only when available and sufficiently accurate. Explain north up and uncertainty; use the explicitly labelled simulator if actual guidance is unavailable.
5. Demonstrate cancelling SOS before the third OK press. Identify the paired friend as the destination.
6. Invite feedback, stop location sharing, disconnect and restore the agreed demonstration state. Follow the consent procedure before recording new evidence.

## Evidence to retain if already available

Date/studio, exhibit photograph, each member's participation, staff/visitor feedback, and resulting decisions. Add genuine records to the wiki; do not invent attendance or backdate this script.
