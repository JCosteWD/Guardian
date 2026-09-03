const { query } = require('../../config/database');

exports.getUrlRules = async (req, res) => {
  const { childId } = req.params;
  try {
    const [urlRules, categoryFilters] = await Promise.all([
      query('SELECT * FROM url_rules WHERE child_id = $1 ORDER BY created_at DESC', [childId]),
      query('SELECT * FROM category_filters WHERE child_id = $1', [childId]),
    ]);
    res.json({ urls: urlRules.rows, categories: categoryFilters.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des filtres' });
  }
};

exports.addUrlRule = async (req, res) => {
  const { childId } = req.params;
  const { domain, isBlocked, category } = req.body;

  try {
    const result = await query(
      `INSERT INTO url_rules (child_id, domain, is_blocked, category)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (child_id, domain) DO UPDATE SET is_blocked = EXCLUDED.is_blocked
       RETURNING *`,
      [childId, domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, ''), isBlocked !== false, category]
    );

    const io = req.app.get('io');
    io.to(`child:${childId}`).emit('rules_updated', { type: 'url_filter', domain });

    res.json({ rule: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'ajout du filtre URL' });
  }
};

exports.updateCategoryFilter = async (req, res) => {
  const { childId } = req.params;
  const { categoryName, isBlocked } = req.body;

  try {
    await query(
      `INSERT INTO category_filters (child_id, category_name, is_blocked)
       VALUES ($1, $2, $3)
       ON CONFLICT (child_id, category_name) DO UPDATE SET is_blocked = EXCLUDED.is_blocked`,
      [childId, categoryName, isBlocked]
    );

    const io = req.app.get('io');
    io.to(`child:${childId}`).emit('rules_updated', { type: 'category', categoryName, isBlocked });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du filtre catégorie' });
  }
};

exports.deleteUrlRule = async (req, res) => {
  const { childId } = req.params;
  const { domain } = req.body;

  try {
    await query(
      'DELETE FROM url_rules WHERE child_id = $1 AND domain = $2',
      [childId, domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '')]
    );

    const io = req.app.get('io');
    io.to(`child:${childId}`).emit('rules_updated', { type: 'url_filter', domain });

    res.json({ message: 'Filtre URL supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression du filtre URL' });
  }
};

exports.deleteCategoryFilter = async (req, res) => {
  const { childId } = req.params;
  const { categoryName } = req.body;

  try {
    await query(
      'DELETE FROM category_filters WHERE child_id = $1 AND category_name = $2',
      [childId, categoryName]
    );

    const io = req.app.get('io');
    io.to(`child:${childId}`).emit('rules_updated', { type: 'category', categoryName, isBlocked: false });

    res.json({ message: 'Filtre catégorie supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression du filtre catégorie' });
  }
};
