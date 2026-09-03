const register = require('./register');
const login = require('./login');
const { refresh, logout } = require('./token');
const pin = require('./pin');
const twoFactor = require('./twoFactor');
const childAuth = require('./childAuth');

module.exports = {
  register: register.register,
  login: login.login,
  refresh,
  logout,
  setPin: pin.setPin,
  setup2FA: twoFactor.setup2FA,
  confirm2FA: twoFactor.confirm2FA,
  childAuth: childAuth.childAuth,
};
