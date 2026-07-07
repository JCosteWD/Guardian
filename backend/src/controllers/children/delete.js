const { query } = require('../../config/database');

exports.deleteChild = async (req, res) => {
  const { childId } = req.params;
  try {
    // Vérifier que l'enfant appartient au parent
    const child = await query(
      'SELECT * FROM children WHERE id = $1 AND parent_id = $2',
      [childId, req.user.id]
    );
    
    if (!child.rows[0]) {
      return res.status(404).json({ error: 'Enfant non trouvé' });
    }

    // Supprimer les données associées dans l'ordre pour respecter les contraintes de clés étrangères
    await query('DELETE FROM app_rules WHERE child_id = $1', [childId]);
    await query('DELETE FROM url_rules WHERE child_id = $1', [childId]);
    await query('DELETE FROM category_filters WHERE child_id = $1', [childId]);
    await query('DELETE FROM quick_presets WHERE child_id = $1', [childId]);
    await query('DELETE FROM grades WHERE child_id = $1', [childId]);
    await query('DELETE FROM activity_logs WHERE child_id = $1', [childId]);
    
    // Supprimer l'enfant
    await query('DELETE FROM children WHERE id = $1', [childId]);

    res.json({ message: 'Enfant supprimé avec succès' });
  } catch (err) {
    console.error('deleteChild error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'enfant' });
  }
};
