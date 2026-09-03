const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { query } = require('../../config/database');

exports.setup2FA = async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Guardian (${req.parent.email})`,
      length: 32,
    });

    await query('UPDATE parents SET totp_secret = $1 WHERE id = $2', [
      secret.base32, req.user.id,
    ]);

    const qrCode = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ secret: secret.base32, qrCode });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la configuration 2FA' });
  }
};

exports.confirm2FA = async (req, res) => {
  const { token } = req.body;
  try {
    const result = await query('SELECT totp_secret FROM parents WHERE id = $1', [req.user.id]);
    const secret = result.rows[0]?.totp_secret;
    if (!secret) return res.status(400).json({ error: '2FA non initialisé' });

    const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
    if (!valid) return res.status(400).json({ error: 'Code invalide' });

    await query('UPDATE parents SET totp_enabled = true WHERE id = $1', [req.user.id]);
    res.json({ message: 'Authentification à deux facteurs activée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la confirmation 2FA' });
  }
};
