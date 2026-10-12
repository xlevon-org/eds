import React, { useState } from 'react';
import { useStudio } from './StudioContext';

export const LoginView: React.FC = () => {
  const { login, register, error, setError } = useStudio();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('verify@up.dev');
  const [password, setPassword] = useState('secret123');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm"
      >
        <div>
          <h2 className="text-lg font-semibold">up Studio</h2>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? 'Sign in to build templates and generate documents.' : 'Create your account.'}
          </p>
        </div>

        {mode === 'register' && (
          <label className="block text-sm">
            <span className="text-muted-foreground">Name</span>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>
        )}

        <label className="block text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            type="email"
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Password</span>
          <input
            type="password"
            required
            minLength={6}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="w-full text-xs text-muted-foreground underline"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
};
