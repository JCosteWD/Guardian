const list = require('./list');
const create = require('./create');
const update = require('./update');
const deleteChild = require('./delete');
const dashboard = require('./dashboard');
const quickAction = require('./quickAction');
const activity = require('./activity');

module.exports = {
  getChildren: list.getChildren,
  createChild: create.createChild,
  updateChild: update.updateChild,
  deleteChild: deleteChild.deleteChild,
  pairDevice: update.pairDevice,
  getChildDashboard: dashboard.getChildDashboard,
  quickAction: quickAction.quickAction,
  logActivity: activity.logActivity,
};
