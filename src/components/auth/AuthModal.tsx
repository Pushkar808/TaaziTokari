// ==============================================================================
// TAAZI TOKARI (ताज़ी टोकरी) - AUTHENTICATION & REGISTRATION MODAL
// One sign-in for customers, operations staff and admins (the account's role decides which
// portal opens), Google sign-in for customers, and customer registration. Every sign-in goes through the
// backend; admin access comes only from the role stored in the database.
// ==============================================================================

import React, { useState } from 'react';
import { UserProfile } from '../../services/store';
import { authService } from '../../services/auth';
import { TaaziTokariEmblem } from '../BrandLogo';
import { GOOGLE_CLIENT_ID, GoogleSignInButton } from './GoogleSignInButton';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
  initialMode?: 'signin' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Google Sign In (the button hands us a Google ID token)
  const handleGoogleSignIn = async (idToken: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { user, error } = await authService.signInWithGoogle(idToken);
      if (error) {
        setErrorMsg(error);
      } else if (user) {
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in encountered an error.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Email / Mobile Password Sign In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const { user, error } = await authService.signInWithEmailPassword(email, password);
      if (error) {
        setErrorMsg(error);
      } else if (user) {
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  // 3. New Customer Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim()) {
      setErrorMsg('Please enter your full name, email, and mobile number.');
      return;
    }
    if (phoneNumber.replace(/\D/g, '').length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number for order dispatch.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Please choose a password of at least 6 characters.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const { user, error } = await authService.registerCustomer({
        fullName,
        email,
        phoneNumber,
        password,
      });
      if (error) {
        setErrorMsg(error);
      } else if (user) {
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-emerald-100 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#072917] px-6 py-5 text-white flex items-center justify-between border-b border-[#14482a]">
          <div className="flex items-center gap-3">
            <TaaziTokariEmblem size={38} />
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                {mode === 'register' ? 'Create Account' : 'Welcome Back'}
                <span className="text-xs font-normal text-emerald-300">
                  {mode === 'register' ? '(पंजीकरण)' : '(साइन इन)'}
                </span>
              </h2>
              <p className="text-xs text-emerald-200/80">
                Taazi Tokari • Kishan Fresh to Kitchen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[85vh]">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMsg(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'signin' ? 'bg-white text-emerald-950 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMsg(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'register' ? 'bg-white text-emerald-950 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              New Customer
            </button>
          </div>

          {/* 1. GOOGLE SIGN-IN (shown only when a Google client id is configured) */}
          {GOOGLE_CLIENT_ID && (
            <div className="space-y-3">
              <GoogleSignInButton onIdToken={handleGoogleSignIn} onError={setErrorMsg} />

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  or with email
                </span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === 'signin' && (
            <form onSubmit={handleEmailSignIn} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. priya.sharma@example.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Mobile Number (For Dawn Delivery SMS) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <p className="text-[11px] text-gray-500 leading-normal">
                🔒 We collect only your name, phone number, and delivery address to fulfill farm orders. We never request Aadhaar or sensitive identity documents.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Creating Profile...' : 'Create Customer Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
