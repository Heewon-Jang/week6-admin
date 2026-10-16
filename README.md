# Caption Admin

Admin area for the Columbia caption app (`week1-hello-world`). It shares that app's Supabase database.

- **Dashboard**: stats from the data (activity by day and hour, crowd favorites, most divisive captions, Elo champions, which Gemini model is funniest, short vs. long captions, most active users)
- **Users**: read profiles
- **AI Media**: create (upload a photo, Gemini describes it and writes captions), read, update and delete photos and captions
- **Votes & Ratings**: read upvotes/downvotes, battle picks and Elo ratings

## Security

Every route is behind Google login, and only profiles with `is_superadmin = true` get in. This is checked in three places:

1. `proxy.ts` redirects every request: no session goes to `/login`, and a user who isn't a superadmin goes to `/denied`.
2. Every page and Server Action calls `requireSuperadmin()` again.
3. In the database, RLS policies built on `public.is_superadmin()` are the only thing that allows reading all profiles or changing captions and images (`supabase/admin.sql`). Users can't grant themselves the flag, because column-level grants keep `is_superadmin` out of what they may insert or update.

## Won't I lock myself out?

The app requires `is_superadmin = true`, and nobody can set that from the app. That's on purpose. The Supabase Dashboard's **SQL Editor** runs as the database owner, and only the project owner can open it, so the first superadmin is created there:

```sql
update public.profiles set is_superadmin = true where email = 'you@columbia.edu';
```

## Setup

1. Run `supabase/admin.sql` in the Supabase SQL Editor, then the `update` above.
2. Environment variables (same values as the main app): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`.
3. In Supabase → Authentication → URL Configuration, add `https://<your-admin-domain>/auth/callback` to the redirect URLs.
4. `npm install && npm run dev`
