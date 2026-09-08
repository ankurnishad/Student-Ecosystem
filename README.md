# Student Ecosystem

Modern student community + education platform for Web and Android.

## Current milestone

Milestone 22: Expo Android client foundation.

### Web setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and anon key.
3. In Supabase Auth settings, disable email confirmation for this username-only credential adapter. The generated auth email is internal and students never enter it.
4. Run `npm install` and `npm run dev`.
5. Open `/register`, create a student account, then use `/profile` to edit the profile and upload an avatar.

### Android setup

The Expo client lives in `mobile/` and uses the same Supabase project, database, Storage buckets and RLS policies as the web app.

1. Install Node.js 22+ and Expo tooling as needed.
2. Copy `mobile/.env.example` to `mobile/.env`.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the same public Supabase values used by the web app.
4. From `mobile/`, run `npm install`.
5. Run `npm start` to open the Expo developer server, then launch the Android target.
6. Use the existing username + password credentials. Sessions are persisted in Android SecureStore.

The mobile foundation currently provides login/session restoration, sign-out, and a basic authenticated navigation shell for Home, Profile, Messages and Groups. Feature screens will incrementally connect to the existing real Supabase data; no mock backend is used.

### Implemented

- Username + password authentication foundation.
- Automatic profile creation from Supabase Auth metadata.
- Student profile fields: display name, username, class, board, stream, bio.
- Private avatar upload to the existing `avatars` Storage bucket.
- Profile editing protected by Supabase RLS.
- Direct and group messaging foundations with realtime support.
- GitHub Actions web typecheck + production build.
- Expo Android client foundation with secure Supabase session persistence.
- GitHub Actions mobile TypeScript typecheck.

Never commit `.env.local`, `mobile/.env`, service-role keys, or other secrets.
