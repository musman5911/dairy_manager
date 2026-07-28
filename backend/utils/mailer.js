const nodemailer = require('nodemailer');

let transporter = null;
let transporterKey = '';

function smtpConfig() {
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 465);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const secure = process.env.SMTP_SECURE != null
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465;

  return { host: smtpHost, port: smtpPort, secure, user: smtpUser, pass: smtpPass };
}

function mailConfigured() {
  const { user, pass } = smtpConfig();
  return Boolean(user && pass);
}

function fromAddress() {
  return process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
}

function appUrl() {
  return process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
}

function getTransporter() {
  const cfg = smtpConfig();

  if (!cfg.user || !cfg.pass) {
    throw new Error('Email is not configured — set SMTP_USER and SMTP_PASS, or EMAIL_USER and EMAIL_PASS.');
  }

  const key = JSON.stringify(cfg);
  if (transporter && transporterKey === key) return transporter;

  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  transporterKey = key;

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  const from = fromAddress();
  return t.sendMail({
    from: String(from || '').includes('<') ? from : `"Usman Dairy Farm" <${from}>`,
    to,
    subject,
    html,
    text,
  });
}

async function sendVerificationCodeEmail({ to, code, username }) {
  const subject = 'Usman Dairy Farm — Password reset code';
  const url = appUrl();
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#ffffff;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#0d9488,#059669);color:white;font-size:28px;line-height:56px;font-weight:bold;">🐄</div>
        <h1 style="margin:12px 0 0;color:#0f172a;font-size:22px;">Usman Dairy Farm</h1>
      </div>
      <p style="color:#334155;font-size:15px;line-height:1.5;">
        Hi <strong>${username || 'admin'}</strong>, use the code below to reset your admin password:
      </p>
      <div style="text-align:center;margin:28px 0;">
        <div style="display:inline-block;letter-spacing:8px;font-size:32px;font-weight:800;color:#0d9488;background:#f0fdfa;padding:16px 28px;border-radius:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
          ${code}
        </div>
      </div>
      <p style="color:#64748b;font-size:13px;line-height:1.5;">
        This code expires in <strong>10 minutes</strong> and can be used only once.
        If you did not request this, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="color:#94a3b8;font-size:12px;text-align:center;">
        Sent from Usman Dairy Farm · <a href="${url}" style="color:#0d9488;">${url}</a>
      </p>
    </div>
  `;
  const text = `Your Usman Dairy Farm password reset code is: ${code}\n\nIt expires in 10 minutes.\nIf you did not request this, ignore this email.`;

  return sendMail({ to, subject, html, text });
}

module.exports = { sendMail, sendVerificationCodeEmail, mailConfigured };
