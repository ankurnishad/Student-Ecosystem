# Student Ecosystem

Modern student community + education platform for Web and Android.

## Current milestone

Milestone 3: student profile editor + avatar upload foundation.

### Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and anon key.
3. In Supabase Auth settings, disable email confirmation for this username-only credential adapter. The generated auth email is internal and students never enter it.
4. Run `npm install` and `npm run dev`.
5. Open `/register`, create a student account, then use `/profile` to edit the profile and upload an avatar.

### Implemented

- Username + password authentication foundation.
- Automatic profile creation from Supabase Auth metadata.
- Student profile fields: display name, username, class, board, stream, bio.
- Private avatar upload to the existing `avatars` Storage bucket.
- Profile editing protected by Supabase RLS.
- GitHub Actions typecheck + production build.

Never commit `.env.local`, service-role keys, or other secrets.
