import { Router }  from 'express';
import { Resend }   from 'resend';
import { v4 as uuid } from 'uuid';
import pool           from '../db/pool.js';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

function otpCode() {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

function otpHtml(username, code, isSignIn) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="width:40px;height:40px;border-radius:10px;background:#6366f1;display:flex;align-items:center;justify-content:center">
          <span style="font-size:20px">📅</span>
        </div>
        <span style="font-size:18px;font-weight:700;color:#1a1b2e">Discord Calendar</span>
      </div>
      <h2 style="font-size:20px;color:#1a1b2e;margin:0 0 8px">
        ${isSignIn ? `Welcome back, ${username}!` : `Verify your account, ${username}!`}
      </h2>
      <p style="color:#5f6080;margin:0 0 24px">
        ${isSignIn
          ? 'Use the code below to sign in. It expires in 15 minutes.'
          : 'Use the code below to verify your new account. It expires in 15 minutes.'}
      </p>
      <div style="background:#f4f5fb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:12px;color:#9899b8;letter-spacing:0.06em;text-transform:uppercase">
          Verification code
        </p>
        <p style="margin:0;font-size:38px;font-weight:700;letter-spacing:0.25em;color:#1a1b2e">
          ${code}
        </p>
      </div>
      <p style="font-size:12px;color:#9899b8;margin:0">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;
}

/* POST /auth/request-code */
router.post('/request-code', async (req, res) => {
  const { email, name, username, isSignup } = req.body;
  const normalEmail = email?.trim().toLowerCase();

  if (!normalEmail?.includes('@')) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    if (isSignup) {
      if (!name?.trim())     return res.status(400).json({ error: 'Display name is required.' });
      if (!username?.trim()) return res.status(400).json({ error: 'Username is required.' });
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        return res.status(400).json({ error: 'Username must be 3–20 characters: letters, numbers, _ only.' });
      }

      const { rows: emailRows } = await pool.query('SELECT id FROM users WHERE email = $1', [normalEmail]);
      if (emailRows.length) return res.status(409).json({ error: 'Email already registered. Sign in instead.' });

      const { rows: userRows } = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
      if (userRows.length) return res.status(409).json({ error: 'Username already taken — try another.' });
    } else {
      const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [normalEmail]);
      if (!rows.length) return res.status(404).json({ error: 'No account found for that email. Sign up instead.' });
    }

    const code    = otpCode();
    const expires = new Date(Date.now() + 15 * 60 * 1_000);

    await pool.query(
      `INSERT INTO pending_otps (email, code, name, username, is_signin, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE
         SET code=$2, name=$3, username=$4, is_signin=$5, expires_at=$6, created_at=NOW()`,
      [normalEmail, code, name?.trim() ?? null, username?.trim() ?? null, !isSignup, expires],
    );

    await resend.emails.send({
      from:    process.env.EMAIL_FROM,
      to:      normalEmail,
      subject: isSignup ? 'Verify your Discord Calendar account' : 'Your Discord Calendar sign-in code',
      html:    otpHtml(isSignup ? name.trim() : 'there', code, !isSignup),
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[auth/request-code]', err.message);
    return res.status(500).json({ error: 'Failed to send code. Please try again.' });
  }
});

/* POST /auth/verify */
router.post('/verify', async (req, res) => {
  const { email, code } = req.body;
  const normalEmail = email?.trim().toLowerCase();

  if (!normalEmail || !code) {
    return res.status(400).json({ error: 'Email and code are required.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM pending_otps WHERE email = $1', [normalEmail]);
    if (!rows.length)           return res.status(400).json({ error: 'No pending verification. Request a new code.' });
    const pend = rows[0];
    if (new Date() > pend.expires_at) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    if (code.trim() !== pend.code)    return res.status(400).json({ error: 'Incorrect code — try again.' });

    // Delete the used OTP
    await pool.query('DELETE FROM pending_otps WHERE email = $1', [normalEmail]);

    let user;
    if (pend.is_signin) {
      const { rows: uRows } = await pool.query('SELECT * FROM users WHERE email = $1', [normalEmail]);
      if (!uRows.length) return res.status(404).json({ error: 'Account not found.' });
      user = uRows[0];
    } else {
      const id = uuid();
      const { rows: uRows } = await pool.query(
        `INSERT INTO users (id, email, name, username, avatar_char)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, normalEmail, pend.name, pend.username, pend.name[0].toUpperCase()],
      );
      user = uRows[0];
    }

    req.session.userId      = user.id;
    req.session.email       = user.email;
    req.session.name        = user.name;
    req.session.username    = user.username;
    req.session.avatarChar  = user.avatar_char;

    return res.json({
      id:       user.id,
      email:    user.email,
      name:     user.name,
      username: user.username,
      avatar:   user.avatar_char,
    });
  } catch (err) {
    console.error('[auth/verify]', err.message);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

/* GET /auth/me */
router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not signed in.' });
  return res.json({
    id:       req.session.userId,
    email:    req.session.email,
    name:     req.session.name,
    username: req.session.username,
    avatar:   req.session.avatarChar,
  });
});

/* POST /auth/logout */
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

export default router;
