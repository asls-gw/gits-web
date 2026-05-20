const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 3;
  if (!rateLimitMap.has(ip)) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  const entry = rateLimitMap.get(ip);
  if (now - entry.start > windowMs) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= maxRequests) return true;
  entry.count++; return false;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost({ request, env }) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return json({ error: 'Too many requests. Wait a minute and try again.' }, 429);
    }

    let data;
    try { data = await request.json(); }
    catch { return json({ error: 'Invalid request' }, 400); }

    if (!env.RESEND_API_KEY) {
      return json({ error: 'Server configuration error: Missing Resend API key.' }, 500);
    }

    const { firstName, lastName, email, phone, service, message, hp_name } = data;

    // Honeypot
    if (hp_name && hp_name.trim() !== '') {
      return json({ success: true }, 200);
    }

    if (!firstName || !email || !message) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return json({ error: 'Invalid email address' }, 400);
    }

    const clean = s => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, 2000);

    const emailBody = {
      from: 'GITS Website <noreply@greenwaveitsolutions.com>',
      to: ['info@greenwaveitsolutions.com'],
      reply_to: email,
      subject: `New inquiry — ${clean(firstName)} ${clean(lastName)} [${clean(service) || 'General'}]`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1f1c">
          <div style="background:#0f2e20;padding:24px 32px;border-radius:8px 8px 0 0">
            <h2 style="color:#6dc98e;margin:0;font-size:1.2rem">New Website Inquiry</h2>
            <p style="color:rgba(255,255,255,.55);margin:4px 0 0;font-size:.8rem">greenwaveitsolutions.com</p>
          </div>
          <div style="background:#f5f4f0;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e0e0dc;border-top:none">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:10px 0;border-bottom:1px solid #e0e0dc;font-size:.8rem;color:#8a9890;width:130px">Name</td><td style="padding:10px 0;border-bottom:1px solid #e0e0dc;font-weight:500">${clean(firstName)} ${clean(lastName)}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e0e0dc;font-size:.8rem;color:#8a9890">Email</td><td style="padding:10px 0;border-bottom:1px solid #e0e0dc"><a href="mailto:${email}" style="color:#2e8050">${email}</a></td></tr>
              ${phone ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e0e0dc;font-size:.8rem;color:#8a9890">Phone</td><td style="padding:10px 0;border-bottom:1px solid #e0e0dc">${clean(phone)}</td></tr>` : ''}
              ${service ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e0e0dc;font-size:.8rem;color:#8a9890">Service</td><td style="padding:10px 0;border-bottom:1px solid #e0e0dc">${clean(service)}</td></tr>` : ''}
              <tr><td style="padding:12px 0;font-size:.8rem;color:#8a9890;vertical-align:top">Message</td><td style="padding:12px 0;line-height:1.7;white-space:pre-wrap;font-size:.9rem">${clean(message)}</td></tr>
            </table>
            <div style="margin-top:20px;padding:12px;background:#fff;border-radius:6px;border:1px solid #e0e0dc;font-size:.75rem;color:#8a9890">
              IP: ${ip} · Reply to this email to respond to ${clean(firstName)}.
            </div>
          </div>
        </div>`
    };

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailBody)
    });

    if (!resendResp.ok) {
      const resendError = await resendResp.text();
      console.error('Resend error:', resendError);
      return json({ error: `Resend API Error: ${resendError}` }, 500);
    }

    return json({ success: true }, 200);
  } catch (err) {
    return json({ error: `Worker Crash: ${err.message}` }, 500);
  }
}