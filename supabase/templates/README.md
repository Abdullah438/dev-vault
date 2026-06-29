# Supabase Auth Email Templates

Branded HTML templates for DevVault. Copy the **body** HTML into the Supabase Dashboard.

## Where to paste

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Go to **Authentication** → **Email Templates**
3. Select the template type and paste the HTML

## Suggested subject lines

| Template | Subject |
|---|---|
| Confirm signup | `Confirm your DevVault account` |
| Reset password | `Reset your DevVault password` |

## Templates

| File | Supabase template |
|---|---|
| `confirm-signup.html` | **Confirm signup** |
| `reset-password.html` | **Reset password** |

## Variables used

Both templates use Supabase Go template variables:

- `{{ .ConfirmationURL }}` — the action link (confirm or reset)
- `{{ .Email }}` — the user's email address

Do not remove these placeholders; Supabase replaces them at send time.

## Tips

- Keep **Redirect URLs** configured under Authentication → URL Configuration so links land on your app (`/auth/callback`, `/update-password`).
- Send yourself a test email from the Supabase dashboard after saving to verify rendering in Gmail, Outlook, etc.
- Some clients strip gradient text on the "Vault" word — the rest of the design still renders correctly with solid fallbacks.
