import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebaseClient';
import '../styles/Auth.css';
import { LogoMark } from './layout/LogoMark';

const googleProvider = new GoogleAuthProvider();

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName) {
          await updateProfile(user, { displayName: fullName });
        }
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError((err as Error).message || 'An error occurred during Google authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container flex items-center justify-center min-h-screen py-10">
      <div className="modern-card w-full max-w-md" style={{ padding: '3rem' }}>
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <LogoMark size="lg" />
          </div>
          <h1 className="view-title text-3xl mb-2">Lobby</h1>
          <p className="text-on-surface-variant text-sm font-medium opacity-70">
            {isLogin ? 'Executive Portal Access' : 'Register New Organization'}
          </p>
        </div>

        <button
          type="button"
          className="primary-button w-full mb-6 flex items-center justify-center gap-3"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="font-bold text-xs uppercase tracking-widest">Sign in with Google</span>
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-white/5"></div>
          <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] opacity-30">or secure login</span>
          <div className="flex-1 h-px bg-white/5"></div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-bold leading-relaxed">
              {error}
            </div>
          )}

          {!isLogin && (
            <div className="form-group-modern">
              <label>Full Identity</label>
              <input
                type="text"
                placeholder="Designated Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="form-group-modern">
            <label>Digital Address</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group-modern">
            <label>Access Key</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="primary-button w-full mt-4 py-4" disabled={loading}>
            <span className="font-black text-xs uppercase tracking-[0.2em]">
              {loading ? 'Authorizing...' : isLogin ? 'Access Vault' : 'Initialize Account'}
            </span>
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-on-surface-variant text-xs font-medium opacity-60">
            {isLogin ? "Unauthorized account?" : "Existing entity?"}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="ml-2 text-primary font-bold hover:underline underline-offset-4"
            >
              {isLogin ? 'Register now' : 'Sign in here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
