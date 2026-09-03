// ══════════════════════════════════════════════════════════════════════════════
// geofencingController.js – Geofencing Zone Management
// Contrôleur pour gérer les zones de géolocalisation (safe zones, etc.)
// ══════════════════════════════════════════════════════════════════════════════

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /children/:childId/geofencing/zones
 * Récupère toutes les zones de géolocalisation d'un enfant
 */
exports.getZones = async (req, res) => {
  try {
    const { childId } = req.params;

    const result = await query(
      `SELECT 
        id, name, latitude, longitude, radius_meters, 
        zone_type, is_active, alert_on_enter, alert_on_exit, 
        created_at, updated_at
      FROM geofencing_zones
      WHERE child_id = $1
      ORDER BY created_at DESC`,
      [childId]
    );

    res.json({
      zones: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    logger.error('getZones error:', err);
    res.status(500).json({ error: 'Impossible de récupérer les zones' });
  }
};

/**
 * POST /children/:childId/geofencing/zones
 * Crée une nouvelle zone de géolocalisation
 */
exports.createZone = async (req, res) => {
  try {
    const { childId } = req.params;
    const { 
      name, 
      latitude, 
      longitude, 
      radius_meters, 
      zone_type, // 'home', 'school', 'safe_place', 'restricted'
      alert_on_enter, 
      alert_on_exit 
    } = req.body;

    // Validation
    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number' || !radius_meters) {
      return res.status(400).json({ error: 'Données manquantes ou invalides' });
    }

    if (radius_meters < 50 || radius_meters > 5000) {
      return res.status(400).json({ error: 'Le rayon doit être entre 50 et 5000 mètres' });
    }

    const result = await query(
      `INSERT INTO geofencing_zones 
        (child_id, name, latitude, longitude, radius_meters, zone_type, alert_on_enter, alert_on_exit, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id, name, latitude, longitude, radius_meters, zone_type, is_active, alert_on_enter, alert_on_exit, created_at`,
      [childId, name, latitude, longitude, radius_meters, zone_type || 'safe_place', alert_on_enter !== false, alert_on_exit !== false]
    );

    res.status(201).json({
      success: true,
      zone: result.rows[0],
      message: `Zone "${name}" créée avec succès`,
    });
  } catch (err) {
    logger.error('createZone error:', err);
    res.status(500).json({ error: 'Impossible de créer la zone' });
  }
};

/**
 * PATCH /children/:childId/geofencing/zones/:zoneId
 * Met à jour une zone existante
 */
exports.updateZone = async (req, res) => {
  try {
    const { childId, zoneId } = req.params;
    const { name, latitude, longitude, radius_meters, zone_type, alert_on_enter, alert_on_exit, is_active } = req.body;

    // Vérifier que la zone appartient à cet enfant
    const zoneCheck = await query(
      'SELECT id FROM geofencing_zones WHERE id = $1 AND child_id = $2',
      [zoneId, childId]
    );

    if (zoneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Zone introuvable' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (latitude !== undefined) {
      updates.push(`latitude = $${paramIndex++}`);
      values.push(latitude);
    }
    if (longitude !== undefined) {
      updates.push(`longitude = $${paramIndex++}`);
      values.push(longitude);
    }
    if (radius_meters !== undefined) {
      updates.push(`radius_meters = $${paramIndex++}`);
      values.push(radius_meters);
    }
    if (zone_type !== undefined) {
      updates.push(`zone_type = $${paramIndex++}`);
      values.push(zone_type);
    }
    if (alert_on_enter !== undefined) {
      updates.push(`alert_on_enter = $${paramIndex++}`);
      values.push(alert_on_enter);
    }
    if (alert_on_exit !== undefined) {
      updates.push(`alert_on_exit = $${paramIndex++}`);
      values.push(alert_on_exit);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(zoneId, childId);

    const result = await query(
      `UPDATE geofencing_zones 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND child_id = $${paramIndex + 1}
       RETURNING id, name, latitude, longitude, radius_meters, zone_type, is_active, alert_on_enter, alert_on_exit, updated_at`,
      values
    );

    res.json({
      success: true,
      zone: result.rows[0],
      message: 'Zone mise à jour avec succès',
    });
  } catch (err) {
    logger.error('updateZone error:', err);
    res.status(500).json({ error: 'Impossible de mettre à jour la zone' });
  }
};

/**
 * DELETE /children/:childId/geofencing/zones/:zoneId
 * Supprime une zone
 */
exports.deleteZone = async (req, res) => {
  try {
    const { childId, zoneId } = req.params;

    const result = await query(
      'DELETE FROM geofencing_zones WHERE id = $1 AND child_id = $2 RETURNING id, name',
      [zoneId, childId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zone introuvable' });
    }

    res.json({
      success: true,
      message: `Zone "${result.rows[0].name}" supprimée`,
    });
  } catch (err) {
    logger.error('deleteZone error:', err);
    res.status(500).json({ error: 'Impossible de supprimer la zone' });
  }
};

/**
 * POST /children/:childId/geofencing/location-update
 * L'appareil enfant envoie une mise à jour de localisation
 * Vérifie si l'enfant entre/sort d'une zone
 */
exports.updateLocation = async (req, res) => {
  try {
    const { childId } = req.params;
    const { latitude, longitude } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Coordonnées invalides' });
    }

    // Enregistrer la localisation
    await query(
      `INSERT INTO location_history (child_id, latitude, longitude, recorded_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (child_id) DO UPDATE SET latitude = $2, longitude = $3, recorded_at = NOW()`,
      [childId, latitude, longitude]
    );

    // Récupérer toutes les zones actives pour cet enfant
    const zonesResult = await query(
      `SELECT id, name, latitude, longitude, radius_meters, alert_on_enter, alert_on_exit, zone_type
       FROM geofencing_zones
       WHERE child_id = $1 AND is_active = true`,
      [childId]
    );

    // Vérifier si l'enfant est entré/sorti de zones
    const alerts = [];
    for (const zone of zonesResult.rows) {
      const distance = calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
      const isInZone = distance <= zone.radius_meters / 1000; // convertir en km

      // Vérifier l'état précédent
      const prevStateResult = await query(
        `SELECT is_inside FROM zone_presence_states 
         WHERE child_id = $1 AND zone_id = $2 
         ORDER BY updated_at DESC LIMIT 1`,
        [childId, zone.id]
      );

      const wasInZone = prevStateResult.rows[0]?.is_inside || false;

      // Mettre à jour l'état
      await query(
        `INSERT INTO zone_presence_states (child_id, zone_id, is_inside, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (child_id, zone_id) DO UPDATE SET is_inside = $3, updated_at = NOW()`,
        [childId, zone.id, isInZone]
      );

      // Créer une alerte si nécessaire
      if (!wasInZone && isInZone && zone.alert_on_enter) {
        alerts.push({
          type: 'zone_enter',
          zone_name: zone.name,
          zone_type: zone.zone_type,
          message: `${zone.name} - Zone entrée`,
        });

        // Émettre l'événement via Socket.io
        const io = req.app.get('io');
        const childOwner = await query('SELECT parent_id FROM children WHERE id = $1', [childId]);
        if (childOwner.rows[0]) {
          io.to(`parent:${childOwner.rows[0].parent_id}`).emit('geofence-alert', {
            childId,
            type: 'zone_enter',
            zone: zone.name,
            timestamp: new Date(),
          });
        }
      }

      if (wasInZone && !isInZone && zone.alert_on_exit) {
        alerts.push({
          type: 'zone_exit',
          zone_name: zone.name,
          zone_type: zone.zone_type,
          message: `${zone.name} - Zone quittée`,
        });

        // Émettre l'événement via Socket.io
        const io = req.app.get('io');
        const childOwner = await query('SELECT parent_id FROM children WHERE id = $1', [childId]);
        if (childOwner.rows[0]) {
          io.to(`parent:${childOwner.rows[0].parent_id}`).emit('geofence-alert', {
            childId,
            type: 'zone_exit',
            zone: zone.name,
            timestamp: new Date(),
          });
        }
      }
    }

    res.json({
      success: true,
      current_location: { latitude, longitude },
      alerts,
    });
  } catch (err) {
    logger.error('updateLocation error:', err);
    res.status(500).json({ error: 'Impossible de mettre à jour la localisation' });
  }
};

/**
 * GET /children/:childId/geofencing/current-location
 * Récupère la dernière localisation connue d'un enfant
 */
exports.getCurrentLocation = async (req, res) => {
  try {
    const { childId } = req.params;

    const result = await query(
      `SELECT latitude, longitude, recorded_at
       FROM location_history
       WHERE child_id = $1
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [childId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aucune localisation enregistrée' });
    }

    res.json({
      location: result.rows[0],
    });
  } catch (err) {
    logger.error('getCurrentLocation error:', err);
    res.status(500).json({ error: 'Impossible de récupérer la localisation' });
  }
};

/**
 * GET /children/:childId/geofencing/location-history
 * Récupère l'historique de localisation (dernières 24h ou limité)
 */
exports.getLocationHistory = async (req, res) => {
  try {
    const { childId } = req.params;
    const hours = req.query.hours || 24;

    const result = await query(
      `SELECT latitude, longitude, recorded_at
       FROM location_history
       WHERE child_id = $1 AND recorded_at > NOW() - INTERVAL '${parseInt(hours)} hours'
       ORDER BY recorded_at DESC
       LIMIT 100`,
      [childId]
    );

    res.json({
      history: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    logger.error('getLocationHistory error:', err);
    res.status(500).json({ error: 'Impossible de récupérer l\'historique' });
  }
};

/**
 * Calcule la distance entre deux coordonnées géographiques (formule Haversine)
 * @param lat1, lon1 - Coordonnées du point 1
 * @param lat2, lon2 - Coordonnées du point 2
 * @returns Distance en km
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = exports;
