/**
 * THE ONE PLACE `unstable-native-tabs` IS NAMED, and that is the whole point of
 * the file.
 *
 * `expo-router/unstable-native-tabs` wears the `unstable-` prefix because the
 * API is expected to break: the path will be renamed when it settles, and props
 * may come and go under it. Every other module in the app imports from HERE, so
 * the rename is the one line below and nothing else moves.
 *
 * It is a re-export and deliberately nothing more — no wrapper component, no
 * defaults baked in. A shim that also made decisions would be a second place to
 * look when the upstream API changes, which is exactly what this file exists to
 * prevent. The decisions live in `app/(tabs)/_layout.tsx` beside the JS tab bar
 * they are the counterpart of.
 *
 * Importing this on Android is harmless — expo-router implements native tabs on
 * both platforms — but nothing renders it there: see the layout's note on why
 * Android keeps the JS `<Tabs>`.
 */
export { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
