import { createClient } from "@supabase/supabase-js";

/**
 * Validate a player's access token with the project's public API key.
 *
 * The service-role client is reserved for privileged database operations;
 * it should not be used as the API key for validating a signed-in user.
 */
export async function getAuthenticatedUser(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase authentication environment variables are missing.");
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return authClient.auth.getUser(accessToken);
}
