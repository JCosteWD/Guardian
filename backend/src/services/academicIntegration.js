// ── ACADEMIC API INTEGRATION SERVICE ─────────────────────────────────────────────
// Service pour connecter l'IA Guardian aux API académiques officielles

const axios = require('axios');
const logger = require('../utils/logger');

// Configuration des API académiques
const ACADEMIC_APIS = {
  // API Éducation Nationale France
  educationNationale: {
    baseUrl: 'https://data.education.gouv.fr/api/records/1.0',
    endpoints: {
      schools: '/search/?dataset=fr-en-annuaire-education&q={query}',
      programs: '/search/?dataset=fr-en-programmes-scolaires&q={subject}&refine.niveau={level}'
    }
  },
  
  // API Open Educational Resources
  oer: {
    baseUrl: 'https://api.oercommons.org',
    endpoints: {
      search: '/resources?q={query}&subject={subject}&grade_level={level}'
    }
  },
  
  // API Khan Academy (si disponible)
  khanAcademy: {
    baseUrl: 'https://www.khanacademy.org/api/v3',
    endpoints: {
      topics: '/exercises?subject={subject}&grade={level}'
    }
  },
  
  // API Wikipedia (pour informations générales)
  wikipedia: {
    baseUrl: 'https://fr.wikipedia.org/w/api.php',
    endpoints: {
      search: '?action=query&list=search&srsearch={query}&format=json',
      content: '?action=query&prop=extracts|pageimages&titles={title}&format=json'
    }
  }
};

class AcademicIntegrationService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 heure
  }

  // ── RECHERCHE ACADEMIQUE ─────────────────────────────────────────────────────
  async searchAcademicContent(query, subject, level) {
    const cacheKey = `${query}-${subject}-${level}`;
    
    // Vérifier le cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Recherche Wikipedia (toujours disponible)
      const wikiResults = await this.searchWikipedia(query);
      
      // Recherche dans l'API Éducation Nationale (si configurée)
      const eduResults = await this.searchEducationNationale(query, subject, level);
      
      // Recherche OER (ressources éducatives ouvertes)
      const oerResults = await this.searchOER(query, subject, level);

      const results = {
        wikipedia: wikiResults,
        educationNationale: eduResults,
        oer: oerResults,
        timestamp: Date.now()
      };

      // Mettre en cache
      this.cache.set(cacheKey, { timestamp: Date.now(), data: results });
      
      return results;
    } catch (error) {
      logger.error('Academic search error:', error);
      return { error: 'Recherche académique indisponible' };
    }
  }

  // ── WIKIPEDIA SEARCH ─────────────────────────────────────────────────────────
  async searchWikipedia(query) {
    try {
      const searchUrl = `${ACADEMIC_APIS.wikipedia.baseUrl}${ACADEMIC_APIS.wikipedia.endpoints.search.replace('{query}', encodeURIComponent(query))}`;
      const response = await axios.get(searchUrl);
      
      if (response.data.query && response.data.query.search) {
        const results = response.data.query.search.slice(0, 3);
        
        // Récupérer le contenu détaillé
        const detailedResults = await Promise.all(
          results.map(async (result) => {
            const contentUrl = `${ACADEMIC_APIS.wikipedia.baseUrl}${ACADEMIC_APIS.wikipedia.endpoints.content.replace('{title}', encodeURIComponent(result.title))}`;
            const contentResponse = await axios.get(contentUrl);
            
            if (contentResponse.data.query && contentResponse.data.query.pages) {
              const pageId = Object.keys(contentResponse.data.query.pages)[0];
              const page = contentResponse.data.query.pages[pageId];
              
              return {
                title: result.title,
                extract: page.extract ? page.extract.substring(0, 500) : '',
                url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(result.title)}`,
                source: 'Wikipedia'
              };
            }
          })
        );
        
        return detailedResults.filter(r => r);
      }
      
      return [];
    } catch (error) {
      logger.warn('Wikipedia search failed:', error.message);
      return [];
    }
  }

  // ── ÉDUCATION NATIONALE SEARCH ─────────────────────────────────────────────────
  async searchEducationNationale(query, subject, level) {
    try {
      const endpoint = ACADEMIC_APIS.educationNationale.endpoints.programs
        .replace('{subject}', encodeURIComponent(subject))
        .replace('{level}', encodeURIComponent(level));
      
      const url = `${ACADEMIC_APIS.educationNationale.baseUrl}${endpoint}`;
      const response = await axios.get(url);
      
      if (response.data.records) {
        return response.data.records.map(record => ({
          title: record.fields.titre || 'Programme officiel',
          description: record.fields.description || '',
          level: record.fields.niveau || level,
          source: 'Éducation Nationale'
        }));
      }
      
      return [];
    } catch (error) {
      logger.warn('Éducation Nationale search failed:', error.message);
      return [];
    }
  }

  // ── OER SEARCH ───────────────────────────────────────────────────────────────
  async searchOER(query, subject, level) {
    try {
      const endpoint = ACADEMIC_APIS.oer.endpoints.search
        .replace('{query}', encodeURIComponent(query))
        .replace('{subject}', encodeURIComponent(subject))
        .replace('{level}', encodeURIComponent(level));
      
      const url = `${ACADEMIC_APIS.oer.baseUrl}${endpoint}`;
      const response = await axios.get(url);
      
      if (response.data.resources) {
        return response.data.resources.slice(0, 3).map(resource => ({
          title: resource.title,
          description: resource.description || '',
          url: resource.url,
          source: 'OER Commons'
        }));
      }
      
      return [];
    } catch (error) {
      logger.warn('OER search failed:', error.message);
      return [];
    }
  }

  // ── CONTEXTE ACADEMIQUE POUR L'IA ───────────────────────────────────────────────
  async getAcademicContextForAI(subject, topic, level) {
    const academicContent = await this.searchAcademicContent(topic, subject, level);
    
    // Formater le contexte pour l'IA
    let context = `INFORMATIONS ACADEMIQUES OFFICIELLES:\n\n`;
    
    if (academicContent.wikipedia && academicContent.wikipedia.length > 0) {
      context += `SOURCES WIKIPEDIA:\n`;
      academicContent.wikipedia.forEach((wiki, index) => {
        context += `${index + 1}. ${wiki.title}: ${wiki.extract}\n`;
      });
      context += `\n`;
    }
    
    if (academicContent.educationNationale && academicContent.educationNationale.length > 0) {
      context += `PROGRAMMES OFFICIELS:\n`;
      academicContent.educationNationale.forEach((edu, index) => {
        context += `${index + 1}. ${edu.title} (${edu.level}): ${edu.description}\n`;
      });
      context += `\n`;
    }
    
    if (academicContent.oer && academicContent.oer.length > 0) {
      context += `RESSOURCES ÉDUCATIVES:\n`;
      academicContent.oer.forEach((oer, index) => {
        context += `${index + 1}. ${oer.title}: ${oer.description}\n`;
      });
    }
    
    return context;
  }

  // ── VALIDATION CONTENU PÉDAGOGIQUE ─────────────────────────────────────────────
  validateEducationalContent(content, level) {
    const levelRequirements = {
      'CE1': { maxWords: 50, maxComplexity: 'very simple' },
      'CE2': { maxWords: 70, maxComplexity: 'simple' },
      'CM1': { maxWords: 90, maxComplexity: 'simple' },
      'CM2': { maxWords: 100, maxComplexity: 'simple' },
      '6eme': { maxWords: 150, maxComplexity: 'intermediate' },
      '5eme': { maxWords: 180, maxComplexity: 'intermediate' },
      '4eme': { maxWords: 200, maxComplexity: 'intermediate' },
      '3eme': { maxWords: 220, maxComplexity: 'intermediate' },
      '2nde': { maxWords: 300, maxComplexity: 'advanced' },
      '1ere': { maxWords: 350, maxComplexity: 'advanced' },
      'Terminale': { maxWords: 400, maxComplexity: 'very advanced' }
    };

    const requirements = levelRequirements[level] || levelRequirements['CM2'];
    const wordCount = content.split(/\s+/).length;
    
    return {
      isValid: wordCount <= requirements.maxWords,
      wordCount,
      maxWords: requirements.maxWords,
      suggestions: wordCount > requirements.maxWords 
        ? [`Réduire le nombre de mots (actuel: ${wordCount}, maximum: ${requirements.maxWords})`]
        : []
    };
  }
}

module.exports = new AcademicIntegrationService();
