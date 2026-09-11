# HoopLog courtside companion

Status: removed from the app at the user's request. The production image and component have been deleted. The notes below are historical art direction only.

The user selected a calm courtside personality and supplied a seated basketball reference. That direction supersedes `tally-concept-v1.png`, which remains an earlier exploration, not a production asset.

Production asset: `livestats/assets/mascot/ready.png`. Generated with the built-in image-generation tool from the supplied reference, then a dark-background variant was selected. It has a matte background, not real transparency; `components/offcourt/Mascot.tsx` uses a radial SVG mask to soften its boundaries against the room.

Art direction: a seated orange basketball with tactile rubber grain, restrained eyes and smile, dark sneakers with warm pale soles and a small orange tab. Preserve the quiet, grounded proportions of the reference while giving HoopLog its own rendering and footwear details. No lettering, props, celebration, speech bubbles or movement. Render centered with breathing room on a near-black warm ground.

Usage: decorative only, hidden from screen readers and touches. It accompanies Lobby and Season empty states, the populated lobby's tutorial link and Team's unnamed-roster helper. Hide the Team helper during editing. It never enters the board, replaces the wordmark or changes a club crest. One static pose ships; additional pose exploration is not needed for the present UI.
