# Student Ecosystem

Modern student community + education platform for Web and Android.

## Current milestone

Milestone 2: username + password authentication foundation.

### Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and anon key.
3. In Supabase Auth settings, disable email confirmation for this username-only credential adapter. The generated auth email is internal and students never enter it.
4. Run `npm install` and `npm run dev`.

Never commit `.env.local`, service-role keys, or other secrets.
