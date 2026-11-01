# NewFlix Ultimate 2026 Update

This package is a complete static front-end rebuild around the supplied NewFlix/Supabase/TMDB architecture.

## Biggest upgrades
- New **Documentaries** navbar section with documentary movies and docuseries.
- Universal instant search suggestions and a full mixed movie/series search page.
- Separate normal player and Watch Together player.
- Continue Watching on the home page with progress bars and resume-from-last-position.
- Preset avatar gallery plus custom avatar upload.
- Cross-device playback preferences after running `supabase/upgrade.sql`.
- Data Saver mode, accent themes, compact catalog mode, and preferred source controls.
- Surprise Me button.
- Richer title pages with trailer, cast and similar titles.
- Quick “My List” button on catalog cards.
- Responsive redesign using the supplied NewFlix visual language and favicon.

## Deploy
1. Back up your existing project.
2. Run `supabase/upgrade.sql` in Supabase SQL Editor.
3. Copy this package into your project/deployment.
4. Confirm `js/config.js` contains the correct Supabase project and TMDB credentials.
5. Deploy to Vercel.

## Database
The only new database requirements are profile preference columns and the avatar Storage bucket/policies. The migration is additive and does not delete data.

## Important player note
Third-party iframe providers control whether their domains allow embedding. A website cannot override a provider's CSP/X-Frame-Options from client JavaScript. The separated Watch Together player therefore uses only the providers already marked as controllable in `js/providers.js` and includes provider failover behavior from the previous rebuild.


## Adaptive Connection Engine
- Same-origin staged speed test with Network Information API hints when available.
- Automatically selects Full, Balanced or Lite rendering.
- Lite mode disables animation/blur-heavy effects for faster browsing.
- Normal and Watch Together source recommendations change with the measured connection.
- Settings includes manual overrides, automatic source selection and a re-test button.
- Speed results are device-local and expire after 30 minutes. Only the user's Auto/manual preference is synced through Supabase.

## Additional providers reviewed from TomasTNunes/TMDB-Player
The upstream project currently defines VixSrc, MoviesAPI, VidSrc, VidEasy, VidFast and VidLink server URLs.

This NewFlix build already included MoviesAPI, VidFast and VidLink. The normal player now also includes VixSrc, VidSrc and VidEasy.

VidEasy is kept only as a temporary manual fallback and is not automatically recommended. The upstream repository still uses an older `vidfast.pro` URL; NewFlix keeps its newer `vidfast.vc` integration.

The newly added sources are normal-player fallbacks only. They are not added to Watch Together unless a documented parent play/pause/seek API is available.

## VixSrc blocking and adaptive-mode revision
VixSrc was removed from the selectable source list after real-world access blocking was reported. The build does not attempt to bypass ISP or provider blocking.

The UI now presents three choices: Auto, Normal and Slow. Auto classifies the current connection; Normal keeps the full animated interface; Slow disables animation/blur and prioritizes adaptive-quality sources.

Verified source strategy:
- StreamVault: primary Slow-mode source; official docs state HLS adaptive bitrate, 12+ source racing/fallback and watch-party controls.
- MoviesAPI: primary Normal-mode source; official docs state quality defaults to Auto/adaptive and expose full postMessage controls.
- VidFast: adaptive-capable fallback already used by NewFlix.
- VidZen: verified full-control fallback.
- VidLink: verified event/resume fallback.
- VidScene remains a fallback but can be frame-blocked in some networks, so it is ranked last in the normal player.

NewFlix cannot force a third-party iframe to a particular bitrate. For adaptive providers, the embedded player itself selects video quality based on throughput.


## Smart TV / remote-first update
- Player opens with a full-screen server chooser; choose a source with the TV remote.
- Selecting a server requests fullscreen immediately from the remote's OK/click gesture, then loads the stream. Browsers do not permit a page to force fullscreen later without a user gesture, so fullscreen cannot be guaranteed when playback begins automatically.
- Arrow keys move focus between controls and scroll the page; OK/Enter activates; Back/Escape closes the server chooser or returns.
- TV mode disables animation, blur, noise and other costly effects. Detected TV browsers default to the lightweight presentation and skip the large connection speed test.
- Sign-in accepts either username or email. Run the updated `supabase/upgrade.sql` migration before using username sign-in. New accounts need a unique username.

### Username sign-in note
The username resolver reads the email stored on the existing `profiles` table. This project already allows public profile reads for its social features; the migration adds an email field to that same table. If you need private email addresses, change the profile RLS model and move username resolution to a rate-limited Supabase Edge Function before production use.


## Username sign-in setup (required)

Username sign-in resolves accounts on the server and does not expose email addresses to browser clients.

1. In Supabase Dashboard → SQL Editor, run the complete updated `supabase/upgrade.sql`.
2. Install the Supabase CLI and link this project to your Supabase project.
3. Deploy the Edge Function: `supabase functions deploy username-login`.
4. The hosted function uses Supabase's `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables. Never put the service-role key in website JavaScript.
5. Test with an existing account username and its password. Email sign-in continues to work.

The SQL migration backfills usernames from `profiles.username` for existing accounts. Confirm that each account has a username saved there before testing.


## Playback health check and automatic server fallback

The standard player now:
- Switches immediately when a provider sends a recognized playback error event.
- Treats a provider `ready`, `play`, or `playing` postMessage event as a positive playback signal.
- Shows a TV-remote-friendly **“Is the video playing correctly?”** prompt after 16 seconds if no positive playback signal arrives.
- On **NO**, automatically tries the next untried server; it asks again if that server also cannot be confirmed.
- On **YES**, marks the server as working for the current session and remembers it as the last confirmed source.
- After all servers are tried, offers **Retry servers** or **Choose manually**.

Important browser limitation: a website cannot inspect whether a cross-origin iframe's video is visibly playing or producing sound. An iframe `load` event only means its page loaded, not that the movie is playing. Therefore, actual automatic detection is possible only for providers that send supported playback/error messages; the confirmation prompt covers providers that do not expose playback status.


## Playback prompt in fullscreen + remote toggle

The playback confirmation prompt is now a child of the video player container, so it remains layered over the video when that container enters browser fullscreen. Use the TV remote's arrow keys to move between YES/NO and OK/Enter to activate. INFO/Menu toggles the prompt; Back toggles it hidden/visible while a confirmation is pending. The prompt remains available until YES or NO is selected.


## Sign in with email, username, OR display name

The sign-in form accepts all three identifiers:
- Email: uses Supabase Auth email/password sign-in directly.
- Username: resolved through the private `newflix_username_index`.
- Display name: resolved by exact case-insensitive matching against `profiles.display_name` on the server.

Display names are not required to be unique. If two or more accounts share the same display name, sign-in returns an ambiguity message and asks the user to use their unique username or email.

To deploy this update:
1. Run the updated `supabase/upgrade.sql` in Supabase SQL Editor (this also backfills missing display names from Auth user metadata).
2. Deploy the updated Edge Function: `supabase functions deploy username-login`.
3. Redeploy the website to Vercel.

The Edge Function uses the service-role key server-side only; it does not return account email addresses during identifier lookup.
