# Laptop R reset and retained arrows

Double-click `ResetBands.command` with both bands connected by USB and other
USB bridges closed. Put Nayaka on the LEFT and Syifa on the RIGHT, face up,
screen tops pointing the same way, 30 cm between their screen centres. Hold
still, focus the controller's Terminal window, and press **R**. No Enter key is
needed. It should print `RESET ... OK` and show Nayaka right / Syifa left.

Slide Nayaka flat about 20 cm toward its screen top, then stop for two seconds.
Nayaka should point down-right and Syifa up-left. Slide Nayaka back and pause;
the arrows should return close to right/left. Repeat with Syifa: moving it
toward its top should make Nayaka point up-right and Syifa down-left. Sideways
and diagonal slides also update the signed X/Y coordinates. Movement directly
along the line between bands can correctly change distance without turning
the arrows; moving both equally leaves their relative direction unchanged.
The arrows stay visible during movement and uncertain tracking. Rejected
handling keeps the last estimated coordinates and shows **R RESET**. Later
measurable flat slides on either band can still change both arrows, but missed
movement leaves those coordinates uncertain. Restore the physical starting
arrangement and press R to clear that uncertainty.

Press **Q** to close the controller before flashing, running other USB tests or
starting the web USB bridge. Closing it does not clear either band's arrow.
The latest real status is saved in `artifacts/reset-controller-state.json`.

After the flat check, try one short forward/backward move while holding a band
slightly above the table, pausing at each end. The experimental three-axis
calculation now estimates lifted/tilted movement as well as flat slides and
projects the relative position into the screen plane. It may drift or reject
long or oversized segments. Completed movements update position; precise
continuous wrist tracking has not been verified. Resetting is an explicit
physical calibration, not an automatic measurement of the bands' positions.
