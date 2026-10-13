// Google's own sign-in button (Google Identity Services). Google gives the browser an
// ID token; the backend verifies it, so the browser never decides who the user is.
import React, { useEffect, useRef } from 'react';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<GoogleIdentity> | null = null;

// Loads Google's script once, however many times the modal opens.
function loadGoogleScript(): Promise<GoogleIdentity> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve((window as unknown as { google: GoogleIdentity }).google);
    script.onerror = () => {
      scriptPromise = null; // allow a retry next time
      reject(new Error('Could not load Google sign-in.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface GoogleSignInButtonProps {
  onIdToken: (idToken: string) => void;
  onError: (message: string) => void;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onIdToken, onError }) => {
  const container = useRef<HTMLDivElement>(null);
  // Google keeps the callback it was given at initialize(), so always call the latest one.
  const handlers = useRef({ onIdToken, onError });
  handlers.current = { onIdToken, onError };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    loadGoogleScript()
      .then((google) => {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => handlers.current.onIdToken(response.credential),
        });
        if (container.current) {
          google.accounts.id.renderButton(container.current, { theme: 'outline', size: 'large', width: 340 });
        }
      })
      .catch((err: Error) => handlers.current.onError(err.message));
  }, []);

  return <div ref={container} className="flex justify-center min-h-[44px]" />;
};
