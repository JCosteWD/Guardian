const { query } = require('../config/database');

exports.getNotificationPreferences = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM notification_preferences WHERE parent_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      // Retourner les préférences par défaut
      return res.json({
        preferences: {
          notif_quota: true,
          notif_tamper: true,
          notif_empty: true,
          notif_quiz: true,
          notif_report: true,
        }
      });
    }
    
    res.json({ preferences: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des préférences' });
  }
};

exports.updateNotificationPreference = async (req, res) => {
  const { key, value } = req.body;
  
  try {
    await query(
      `INSERT INTO notification_preferences (parent_id, ${key})
       VALUES ($1, $2)
       ON CONFLICT (parent_id) DO UPDATE SET ${key} = EXCLUDED.${key}`,
      [req.user.id, value]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
};
