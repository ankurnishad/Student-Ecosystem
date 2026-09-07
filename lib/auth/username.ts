export function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

// Supabase Auth uses email/password under the hood. The app-facing credential
// remains username/password; this deterministic internal address is never shown.
export function usernameAuthEmail(username: string) {
  return `${normalizeUsername(username)}@auth.student-ecosystem.local`
}
