
import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Sparkles, User, MailCheck, AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase';

interface LoginProps {
  onGuest: () => void;
  onSignIn: (
    email: string,
    password: string,
    tab: 'signin' | 'signup',
  ) => Promise<{ needsConfirmation?: boolean } | void>;
}

const Login: React.FC<LoginProps> = ({ onGuest, onSignIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [confirmSent, setConfirmSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    // Auth is misconfigured at build time — a request would fail as a generic
    // fetch error and read as "the server is down", sending the user (and us)
    // to debug the network instead of the missing env vars.
    if (!isSupabaseConfigured) {
      setError('Sign-in is unavailable: this build has no Supabase credentials. Use "Continue as Guest" for now.');
      return;
    }
    setLoading(true);
    try {
      const res = await onSignIn(email, password, tab);
      // Signup with email confirmation enabled: no session yet — show a
      // "check your email" screen instead of leaving the user staring at the form.
      if (res && res.needsConfirmation) {
        setConfirmSent(true);
        return;
      }
    } catch (err: any) {
      const msg = err?.message || '';
      const name = err?.name || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) setError('Email already registered.');
      else if (msg.includes('Invalid login credentials')) setError('Invalid email or password.');
      else if (msg.includes('Password should be at least')) setError('Password must be at least 6 characters.');
      else if (msg.includes('Unable to validate email')) setError('Please enter a valid email address.');
      // The credentials are well-formed but the request never landed. In practice
      // this is almost always a paused Supabase project (the free tier suspends
      // after ~7 days idle) or a URL pointing at a project that no longer exists —
      // not a transient blip, so don't tell the user to just wait it out.
      else if (name === 'AuthRetryableFetchError' || msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
        setError("Can't reach the authentication server. If this persists, the Supabase project may be paused or its URL may be wrong — check the Supabase dashboard.");
        console.error('[auth] Request to Supabase failed. Verify the project is active and VITE_SUPABASE_URL is correct.', err);
      }
      else setError(msg || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F9] flex">

      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1F1F1F] flex-col justify-between p-14">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow">
            <span className="font-black text-[#1F1F1F] text-xl">L</span>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">LandIt</span>
        </div>

        {/* Hero copy */}
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-snug">
            Your personal<br />
            <span className="text-[#7BAAF7]">AI interview coach</span><br />
            for Product roles.
          </h1>
          <p className="text-[#9AA0A6] text-base leading-relaxed max-w-sm">
            Upload your resume, target your dream role, and practice with an AI interviewer that knows your profile inside out.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {['Gap Analysis', 'Live Mock Interview', 'AI Feedback', 'Question Bank'].map(f => (
              <span key={f} className="text-xs font-semibold text-[#C4C7C5] bg-white/10 px-3 py-1.5 rounded-full">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <p className="text-[#5F6368] text-xs">
          USC · Spring 2026 · Built for aspiring PMs
        </p>
      </div>

      {/* ── Right panel: auth ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-[#1F1F1F] rounded-xl flex items-center justify-center">
              <span className="font-black text-white text-lg">L</span>
            </div>
            <span className="text-lg font-bold text-[#1F1F1F]">LandIt</span>
          </div>

          {confirmSent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-[#E6F4EA] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <MailCheck className="w-7 h-7 text-[#137333]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1F1F1F] mb-2">Check your email</h2>
              <p className="text-sm text-[#444746] leading-relaxed mb-1">
                We've sent a confirmation link to
              </p>
              <p className="text-sm font-bold text-[#1F1F1F] mb-6 break-all">{email}</p>
              <p className="text-xs text-[#444746] leading-relaxed mb-8">
                Click the link in that email to activate your account, then come back and sign in.
                Didn't get it? Check your spam folder.
              </p>
              <button
                onClick={() => { setConfirmSent(false); setTab('signin'); setPassword(''); setError(''); }}
                className="w-full py-3 bg-[#0B57D0] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#0842A0] transition-all shadow-sm active:scale-[0.98]"
              >
                Back to Sign In
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
          <>
          <h2 className="text-2xl font-bold text-[#1F1F1F] mb-1">
            {tab === 'signin' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-sm text-[#444746] mb-8">
            {tab === 'signin' ? 'Sign in to continue your interview prep.' : 'Start your PM interview journey.'}
          </p>

          {/* Build-time config problem: surface it up front rather than letting
              every sign-in attempt fail with a misleading network error. */}
          {!isSupabaseConfigured && (
            <div className="flex gap-2.5 mb-6 px-3 py-2.5 bg-[#FEF7E0] border border-[#F9AB00]/30 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-[#B06000] shrink-0 mt-0.5" />
              <div className="text-xs text-[#B06000] leading-relaxed">
                <span className="font-bold">Sign-in is unavailable.</span>{' '}
                {supabaseConfigError}. Set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>, then rebuild — Vite bakes
                them in at build time. Guest mode still works.
              </div>
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex bg-[#F0F4F9] rounded-xl p-1 mb-6">
            {(['signin', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? 'bg-white text-[#1F1F1F] shadow-sm' : 'text-[#444746]'
                }`}
              >
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-[#E3E3E3] rounded-xl text-sm text-[#1F1F1F] bg-white focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 focus:border-[#0B57D0] transition-all placeholder-[#C4C7C5]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 border border-[#E3E3E3] rounded-xl text-sm text-[#1F1F1F] bg-white focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 focus:border-[#0B57D0] transition-all placeholder-[#C4C7C5]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4C7C5] hover:text-[#444746] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[#B3261E] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0B57D0] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#0842A0] transition-all shadow-sm active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {tab === 'signin' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#E3E3E3]" />
            <span className="text-xs text-[#C4C7C5] font-medium">or</span>
            <div className="flex-1 h-px bg-[#E3E3E3]" />
          </div>

          {/* Guest button */}
          <button
            onClick={onGuest}
            className="w-full py-3 border-2 border-dashed border-[#C4C7C5] rounded-xl text-sm font-semibold text-[#444746] flex items-center justify-center gap-2 hover:border-[#0B57D0] hover:text-[#0B57D0] hover:bg-[#F0F4F9] transition-all group"
          >
            <User className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Continue as Guest
            <span className="text-[10px] font-bold text-[#C4C7C5] bg-[#F0F4F9] group-hover:bg-white px-1.5 py-0.5 rounded ml-1 transition-colors">
              ONE-TIME
            </span>
          </button>

          <p className="text-center text-[10px] text-[#C4C7C5] mt-6 leading-relaxed">
            Full functionality, no signup required.<br />
            Your data stays only in this browser session.
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
