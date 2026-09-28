# Deriv Live Analyser & Trading Helper

**Educational tool only.**  
Live tick analysis for Even/Odd, Over/Under, Matches/Differs, Rise/Fall (Only Up / Only Down), High Tick / Low Tick on Deriv synthetic indices.

Includes:
- Real-time tick stream & last-digit statistics
- Live price proposals
- Hedge-style mode (simultaneous opposing contracts for CALL/PUT and TICKHIGH/TICKLOW)
- Optional auto-trade panel (simulation by default; real trades only if you paste your own API token)

## ⚠️ CRITICAL DISCLAIMER

- This is **not** financial advice.
- Automated and discretionary trading of binary/digit options involves **substantial risk of loss**.
- The house edge exists on every contract.
- Never trade with money you cannot afford to lose.
- Always start on a **Demo** account.
- The authors and this repository accept **no responsibility** for any losses.
- Past digit patterns do **not** predict future ticks (especially on pure synthetics).

## Quick Start (Local)

1. Open `index.html` in a modern browser, **or**
2. Deploy to Netlify (recommended).

## How to use real trading (optional)

1. Go to [https://app.deriv.com](https://app.deriv.com) → Settings → Security & Privacy → API Token.
2. Create a token with **Trade** and **Read** permissions (use Demo first!).
3. Paste the token into the tool when prompted.
4. The tool never stores your token on any server — it stays in browser memory only.

You also need a free App ID from [https://api.deriv.com](https://api.deriv.com) (the default public test ID `1089` works for analysis).

## Features

| Market Type          | Analysis                  | Proposal | Hedge Mode |
|----------------------|---------------------------|----------|------------|
| Even / Odd           | Live % + streak           | Yes      | —          |
| Over / Under         | Live % + streak           | Yes      | —          |
| Matches / Differs    | Digit frequency           | Yes      | —          |
| Only Up / Only Down  | Tick direction stats      | Yes      | Yes        |
| High Tick / Low Tick | Selected tick prediction  | Yes      | Yes        |

## Tech

- Pure HTML / CSS / Vanilla JS
- Connects to `wss://ws.derivws.com/websockets/v3`
- No backend required for analysis
- Netlify-ready

## License

MIT — use at your own risk.
