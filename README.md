# Web Systems Security - Final Project: Autonomous XSS to CSRF Web Worm
## Author:
  **Israel Shemesh, Ido Agai**

## Overview
[cite_start]This repository contains my final project for the Web Systems Security course[cite: 2]. [cite_start]The project follows **Track A (Vulnerability Research and POC)**, demonstrating a sophisticated "Vulnerability Chaining" attack. It combines a Stored Cross-Site Scripting (XSS) vulnerability with a Cross-Site Request Forgery (CSRF) bypass to create an autonomous, self-propagating Web Worm.

## The Environment & Defenses
The target is a custom-built, real-time chat application designed as a "Fortress" with multiple layers of defense:
* **Frontend:** React, `socket.io-client`, and `DOMPurify` for input sanitization.
* **Backend:** Node.js, Express, MongoDB Atlas.
* **Security Mechanisms:** Strict CORS, Content Security Policy (CSP), Helmet (X-Frame-Options, X-Content-Type-Options), HttpOnly & SameSite=Lax JWT cookies, a timing-based Rate Limiter, server-side HTML sanitization (`sanitize-html`), and a custom stateful Anti-CSRF token system.

## The Vulnerability (POC)
The vulnerability stems from a logical flaw introduced by a "Rich Media" requirement. While the server and client sanitizers correctly allow specific `<iframe>` tags, the frontend utilizes the dangerous `window.eval()` function to execute text hidden within these allowed iframes.

By injecting a Base64 encoded payload into the iframe, the worm executes within the victim's Same-Origin context. It achieves Ambient Authority, neutralizes CORS, fetches a valid CSRF token, bypasses the 1000ms Rate Limiter using calculated asynchronous delays, and successfully propagates to all active conversations. It also maintains persistence via a `MutationObserver` (locking the victim's screen) and automatically transmits an infection telemetry report back to the attacker.

## Repository Structure
* `/client` - The React frontend application.
* `/server` - The Node.js/Express backend application.
* `WebSec_Project_Report.pdf` - The comprehensive research report detailing the attack flow, defense failures, and proposed mitigations.
* `worm_payload.js` - The raw, unencoded JavaScript payload of the worm for easy review.

## How to Run
1. **Clone the repository:** `git clone <repo-url>`
2. **Start the Server:**
   ```bash
   cd server
   npm install
   node index.js
3. **Start the Client:**
      cd client
      npm install
      npm run dev
4. **Sand the worm:**
	   connect with 2(or more) users. (u can creat by urself for example: user name = hacker , phone = 054)
       open the chat page(at the app) with someone to talk(at the contact list)
       in the attacker web open dev tool and in console type:
	   localStorage.setItem('BOSS', 'true');
       send the encoder worm
       and look in the victim page

