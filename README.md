# Port-Pourri site

Static landing page for Port-Pourri. Drop the contents of this folder into your GitHub Pages repo (everything goes at the repo root) and push.

## Before you publish

Open `index.html` and find this line near the top of the body:

    <a class="sign-link" href="REPLACE_WITH_TICKET_URL" ...

Swap `REPLACE_WITH_TICKET_URL` for your actual ticket URL. That's the only edit you need to make.

## What's here

- `index.html` ... markup
- `styles.css` ... styling, including the flip animation
- `script.js` ... handles the two-tap behavior on touch devices
- `front.png` ... the orange "cada um tem sua porto" sign, shown first
- `rear.png` ... the cream credits sign with the ticket call to action
- `CNAME` ... tells GitHub Pages this site lives at portpourri.sebastian.blue

## How the interaction works

On desktop, hovering over the sign flips it to reveal the credits side. Clicking goes to your ticket URL.

On mobile, the first tap flips the sign. The second tap goes to the ticket URL. If the user taps once and walks away, the sign flips back to the front after about 4.5 seconds.

The rear face renders in portrait orientation (rotated 90° clockwise) regardless of the landscape card container — the image is scaled and centered via CSS so it fills the full card.

The whole thing also responds to keyboard focus and respects `prefers-reduced-motion`.

## DNS reminder

GitHub Pages will detect the CNAME file and try to serve the site at portpourri.sebastian.blue. Make sure you've added a CNAME record at your DNS provider pointing `portpourri` to `yourgithubusername.github.io` for it to actually resolve.
