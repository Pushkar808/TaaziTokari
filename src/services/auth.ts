// Sign-in and sign-up go through the backend, which hashes passwords, verifies Google
// tokens and issues the login token. The role always comes from the server's database.
import { http, tokenStore } from './api/http';
import type { UserProfile } from './store';

type AuthResult = { user: UserProfile | null; error?: string };
type Session = { token: string; user: UserProfile };

// Stores the token from a successful sign-in/up and turns a failure into an error message.
async function startSession(request: Promise<Session>): Promise<AuthResult> {
  try {
    const { token, user } = await request;
    tokenStore.set(token);
    return { user };
  } catch (err) {
    return { user: null, error: (err as Error).message };
  }
}

export const authService = {
  // Restores the session on page load from the saved token.
  async initSession(): Promise<UserProfile | null> {
    if (!tokenStore.get()) return null;
    try {
      return await http.get<UserProfile>('/auth/me');
    } catch {
      tokenStore.clear(); // expired or invalid token
      return null;
    }
  },

  signInWithGoogle: (idToken: string) => startSession(http.post<Session>('/auth/google', { idToken })),

  signInWithEmailPassword: (email: string, password: string) =>
    startSession(http.post<Session>('/auth/login', { email: email.trim(), password })),

  registerCustomer: (params: { fullName: string; email: string; phoneNumber: string; password: string }) =>
    startSession(
      http.post<Session>('/auth/register', {
        fullName: params.fullName.trim(),
        email: params.email.trim(),
        phoneNumber: params.phoneNumber.trim(),
        password: params.password,
      })
    ),

  signOut(): void {
    tokenStore.clear();
  },
};
