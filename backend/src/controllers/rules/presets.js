const { query } = require('../../config/database');

exports.getPresets = async (req, res) => {
  const { childId } = req.params;
  try {
    const result = await query(
      'SELECT * FROM quick_presets WHERE parent_id = $1 AND child_id = $2 ORDER BY sort_order',
      [req.user.id, childId]
    );

    if (result.rows.length === 0) {
      const defaults = [
        { name: 'Mauvaise note', icon: '📉', color: '#FF6B6B', timeDelta: -30, message: 'Tes résultats scolaires nécessitent plus de travail.' },
        { name: 'Bonne note', icon: '⭐', color: '#51CF66', timeDelta: 20, message: 'Bravo pour tes efforts !' },
        { name: 'Mauvais comportement', icon: '⚠️', color: '#FF922B', timeDelta: -45, message: 'Un comportement inapproprié a été signalé.' },
        { name: 'Mode devoirs', icon: '📚', color: '#4C6EF5', blockAll: true, message: 'C\'est l\'heure des devoirs !' },
      ];
      return res.json({ presets: defaults, isDefault: true });
    }

    res.json({ presets: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des presets' });
  }
};

exports.createPreset = async (req, res) => {
  const { childId } = req.params;
  const { name, icon, color, timeDeltaMins, blockGames, blockSocial, blockVideos, blockAllExceptSchool, customMessage } = req.body;

  try {
    const result = await query(
      `INSERT INTO quick_presets
         (parent_id, child_id, name, icon, color, time_delta_mins,
          block_games, block_social, block_videos, block_all_except_school, custom_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [req.user.id, childId, name, icon || '⚡', color || '#FF6B6B',
       timeDeltaMins || 0, blockGames || false, blockSocial || false,
       blockVideos || false, blockAllExceptSchool || false, customMessage]
    );
    res.status(201).json({ preset: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création du preset' });
  }
};

exports.deletePreset = async (req, res) => {
  const { childId } = req.params;
  const { presetId } = req.body;

  try {
    await query(
      'DELETE FROM quick_presets WHERE id = $1 AND parent_id = $2 AND child_id = $3',
      [presetId, req.user.id, childId]
    );
    res.json({ message: 'Preset supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression du preset' });
  }
};
