import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Login failed. Check your credentials.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Edu CRM Login</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required />
          </label>
          {error && <div className="alert">{error}</div>}
          <button type="submit">Sign in</button>
        </form>
      </div>
    </div>
  );
}
