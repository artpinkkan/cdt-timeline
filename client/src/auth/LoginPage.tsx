import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try { await login(username, password); }
    catch (err: any) { setError(err.message || 'Login failed'); }
    finally { setIsLoading(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 13px', fontSize: 13,
    background: '#F8FAFF', border: '1px solid #E8ECF4',
    borderRadius: 10, color: '#0F172A', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F5F7FF', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 36, background: '#fff', border: '1px solid #E8ECF4', borderRadius: 20, boxShadow: '0 4px 24px rgba(99,102,241,0.08)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 auto 14px' }}>F</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>FinalPush.io</h1>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: '#94A3B8' }}>Sign in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" style={inp} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" style={inp} />
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 9, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '11px', fontSize: 14, fontWeight: 700, color: '#fff', background: isLoading ? '#A5B4FC' : '#6366F1', border: 'none', borderRadius: 10, cursor: isLoading ? 'default' : 'pointer', boxShadow: isLoading ? 'none' : '0 2px 10px rgba(99,102,241,0.3)', transition: 'all 0.2s' }}>
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 12, color: '#CBD5E1', textAlign: 'center' }}>Demo · admin / password123</p>
      </div>
    </div>
  );
}
