const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/**
 * ZUSTAND IS RESOLVED WITHOUT THE `import` CONDITION ON WEB, AND ONLY ZUSTAND.
 *
 * Its `exports` map offers three branches: `react-native` and `default` both
 * point at the CommonJS build, `import` points at `esm/*.mjs`. Native takes the
 * first — Metro adds `react-native` to the condition names for ios/android — so
 * the store code every screen imports has never been near the ESM build.
 *
 * WEB HAS NO SUCH CONDITION, so `import` wins there, and `esm/middleware.mjs`
 * reads `import.meta.env.MODE` twice inside the `devtools` middleware. Metro
 * serves the web bundle as a CLASSIC SCRIPT, where `import.meta` is a SYNTAX
 * ERROR — so the file never even parsed. Nothing threw at runtime and nothing
 * appeared in the terminal: the bundle 200s, the browser refuses the whole
 * script, and the page is BLANK with one `Uncaught SyntaxError` in the console.
 *
 * `devtools` is not imported anywhere in this app. `persist` and
 * `createJSONStorage` are, from `zustand/middleware`, and that is one module —
 * so four stores pull the whole file in and one line of a middleware nobody
 * uses took the web build down.
 *
 * WHAT SWITCHES IT IS `isESMImport`, NOT `unstable_conditionNames`. Metro
 * builds its condition set as `['default', isESMImport ? 'import' : 'require',
 * ...unstable_conditionNames]` — so `import` is not a name you can take OUT of
 * that list, it is a branch decided by whether the REQUESTING statement was an
 * ESM `import`. The stores say `import { persist } from 'zustand/middleware'`,
 * so it is. Clearing the condition names moves nothing; `isESMImport: false` is
 * the only lever, and it lands the resolution on `default` — the same CommonJS
 * build native has always used, which carries no `import.meta`.
 *
 * It is scoped to this one package on purpose: flipping the flag globally would
 * push every other dependency onto a build it was not being tested against.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const zustand = moduleName === 'zustand' || moduleName.startsWith('zustand/');

  if (platform === 'web' && zustand) {
    return context.resolveRequest({ ...context, isESMImport: false }, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
