const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const relativeJavaScriptModule = /^\.{1,2}\/.+\.js$/;

function resolveRequest(context, moduleName, platform) {
  if (relativeJavaScriptModule.test(moduleName)) {
    try {
      return context.resolveRequest(
        context,
        moduleName.slice(0, -'.js'.length),
        platform,
      );
    } catch {
      // Fall through for a real JavaScript file that needs its explicit suffix.
    }
  }

  return context.resolveRequest(context, moduleName, platform);
}

config.resolver.resolveRequest = resolveRequest;

module.exports = config;
