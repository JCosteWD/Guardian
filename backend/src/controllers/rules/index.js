const screenTime = require('./screenTime');
const apps = require('./apps');
const urls = require('./urls');
const grades = require('./grades');
const presets = require('./presets');
const deviceCheck = require('./deviceCheck');

module.exports = {
  getScreenTimeRules: screenTime.getScreenTimeRules,
  updateScreenTimeRule: screenTime.updateScreenTimeRule,
  getAppRules: apps.getAppRules,
  setAppRule: apps.setAppRule,
  deleteAppRule: apps.deleteAppRule,
  getUrlRules: urls.getUrlRules,
  addUrlRule: urls.addUrlRule,
  deleteUrlRule: urls.deleteUrlRule,
  updateCategoryFilter: urls.updateCategoryFilter,
  deleteCategoryFilter: urls.deleteCategoryFilter,
  addGrade: grades.addGrade,
  getPresets: presets.getPresets,
  createPreset: presets.createPreset,
  deletePreset: presets.deletePreset,
  getActiveRules: deviceCheck.getActiveRules,
};
