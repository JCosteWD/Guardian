const bcrypt = require('bcryptjs');
const { query } = require('../../config/database');

exports.setPin = async (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ error: 'Le PIN doit contenir entre 4 et 8 chiffres' });
  }
  try {
    const hash = await bcrypt.hash(pin, parseInt(process.env.PIN_SALT_ROUNDS) || 12);
    await query('UPDATE parents SET pin_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'PIN configuré avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la configuration du PIN' });
  }
};
