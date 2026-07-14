# KOBOLD Application Filler

The Chrome extension fills recognizable, empty application fields from the
authenticated KOBOLD profile. It never submits an application.

## Build And Install

```bash
npm run build:extension
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select `extension/dist`.
4. Pin **KOBOLD Application Filler** to the toolbar.

Rebuild and reload the extension after any source change.

## Use

1. Sign in to `https://kobold-gamma.vercel.app` in Chrome and complete Profile.
2. Open the extension and choose **Sync profile**.
3. Open an application form and choose **Fill this page**.
4. Review every field, attach the CV, answer manual questions, and submit the
   application yourself.

Green markings identify fields KOBOLD filled. Pink markings identify fields
that require manual review.

## Safety And Privacy

- Filling runs only after the toolbar popup is opened and the user chooses the
  fill action.
- The extension requests temporary access to the active tab; it has no
  persistent permission to read job sites.
- Existing field values are never overwritten.
- File uploads, cover letters, compensation, work authorization, visa,
  sponsorship, and demographic questions are never filled automatically.
- The extension stores only a minimized copy of the KOBOLD profile in local
  Chrome extension storage. Use **Clear synced profile** to remove it.
- No form submit button is clicked and no form submission API is called.

Profile sync is restricted to the production KOBOLD origin declared in the
extension manifest. A signed-in KOBOLD browser session is required.

## Verification

```bash
npm run typecheck:extension
npm run build:extension
npx vitest run extension
```

The fixture at `extension/fixtures/application-form.html` provides a local form
for manual integration checks.
