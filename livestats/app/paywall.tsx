import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { BENEFITS, DEFAULT_PLAN, type Plan } from '../lib/billing';
import { usePurchaseOptions } from '../hooks/usePurchases';

import { Bloom } from '../components/ui/Bloom';
import { HeroArt } from '../components/ui/HeroArt';
import { DarkRoom } from '../components/ui/DarkRoom';
import { GlowText } from '../components/ui/GlowText';
import { Press } from '../components/ui/Press';
import { Col, Row } from '../components/ui/Row';
import { Btn } from '../components/panels/shell';
import { useMetrics } from '../theme/metrics';
import {
  LS_CAPS,
  LS_LABEL,
  LS_MICRO,
  LS_TIGHT,
  LS_TITLE,
  fNum,
  fUi,
  ls,
} from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

type StorePlan = Omit<Plan, 'price'> & { priceText: string };
const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL;

/**
 * THE PAYWALL.
 *
 * A ROUTE AND NOT A PANEL, for the reason `app/settings.tsx` is one: every
 * panel in this app is a single decision made with the game in front of you,
 * and this is a page that is read, compared and scrolled. It also has to open
 * from places that have no `<PanelHost />` under them — the saved game's export
 * button, a competition page — and a second modal system is two to keep in
 * step.
 *
 * ## THE LAYOUT IS THE REFERENCE'S, TOP TO BOTTOM
 *
 * The photograph, the close, the headline, three benefits, two plan cards, the
 * verb. What is NOT here is the reference's FREE TRIAL ENABLED switch: the
 * trial in this app is a free GAME the scorer already has rather than a plan
 * they can select, so a toggle offering it would be selling somebody something
 * they own — and a switch whose only job is to pick the card underneath it is a
 * second control for one decision.
 *
 * ## IT IS ALWAYS CLOSABLE, AND THAT IS LOAD-BEARING
 *
 * The `×` never goes away, even after the free game is spent. A scorer who has
 * used their trial still owns that game's team line, and a wall with no way
 * past it would put their own numbers behind a door they cannot open. A paywall
 * that makes the app a brick is not a stronger paywall; it is an app nobody can
 * demonstrate to the person who was going to pay for it.
 *
 * ## THE PHOTOGRAPH IS THE LOBBY'S
 *
 * Same file, same two-gradient fade as `HeaderArt`. It is faded by GRADIENTS
 * rather than by `opacity` for the reason written there: a flat opacity lifts
 * the whole picture toward the room's ground and reads as a dull rectangle laid
 * over it, where a wash runs the room's own `bg` back over the image and leaves
 * the far corner at full contrast. Here it runs full width — this screen has no
 * column beside it to keep clear — and fades DOWN into the headline.
 */

/** How much of the window the picture takes. The reference gives it about 40%. */
const ART_H = 0.38;

/**
 * THE COLUMN'S OWN MEASURE. Everything under the picture is capped on it and
 * centred, so a tablet reads a paywall rather than a billboard.
 */
const MEASURE = 700;

/**
 * `Upgrade to access` MEASURED IN EMS: the rendered width of that exact
 * string in the body face at Bold, `LS_TITLE` included, is this many times
 * the font size. Taken off the real thing rather than estimated — Inter Bold,
 * which is the WIDER of the two faces the app draws (iOS gets SF, which is
 * narrower), so the number is the conservative one.
 *
 * IT IS WHAT MAKES THE HEADLINE FIT ON ONE LINE. See `headFs`.
 */
const HEAD_EM = 9;

/**
 * THE PICTURE IS `components/ui/HeroArt.tsx` NOW, because the door's last step
 * draws the same one — the trial's own offer, one tap from this screen. The
 * construction and both washes are written there; nothing about them changed.
 */

/**
 * ONE BENEFIT LINE: a glyph, then a sentence with its noun in bold.
 *
 * The bold half is the reference's own device and it is what makes three short
 * lines scannable rather than three sentences. The glyph family is the tab
 * bar's `MaterialCommunityIcons` — the app has one icon set and a second here
 * would read as a screen borrowed from another product.
 */
function Benefit({ icon, lead, bold, tail }: (typeof BENEFITS)[number]) {
  const m = useMetrics();
  const t = useTheme();
  const size = m.fsSm;

  return (
    <Row gap={m.s3} align="center">
      <MaterialCommunityIcons
        name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={m.fsLg}
        color={t.accent}
        // the glyphs are different widths and a ragged left edge on three
        // stacked lines reads as three unrelated rows
        style={{ width: m.fsLg, textAlign: 'center' }}
      />
      <Text
        style={{
          flex: 1,
          ...fUi(400),
          fontSize: size,
          lineHeight: size * 1.45,
          letterSpacing: ls(size, LS_LABEL),
          color: t.ink2,
        }}
      >
        {lead}
        <Text style={{ ...fUi(700), color: t.ink }}>{bold}</Text>
        {tail}
      </Text>
    </Row>
  );
}

/**
 * A PLAN CARD.
 *
 * SELECTION IS AN ACCENT EDGE AND NOTHING ELSE — no fill, no tint, no swap of
 * the ink. The two cards have to be read against each other, and a filled
 * selected card stops being comparable with the one beside it; the edge says
 * WHICH without changing WHAT either card looks like. It is the same argument
 * the shelf makes for its rows having no fill.
 *
 * The BADGE is the one standing fill on the screen, and only ever on one card.
 */
function PlanCard({
  plan,
  selected,
  onPress,
}: {
  plan: StorePlan;
  selected: boolean;
  onPress(): void;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Press
      accessibilityLabel={`${plan.title}, ${plan.priceText} ${plan.per}`}
      onPress={onPress}
      style={{
        borderRadius: m.r,
        borderWidth: 2,
        borderColor: selected ? t.accent : t.rule,
        backgroundColor: t.surface,
        paddingVertical: m.s3,
        paddingHorizontal: m.s4,
      }}
      pressedStyle={{ borderColor: selected ? t.accent2 : t.line }}
    >
      <Row gap={m.s3} align="center">
        <Col gap={m.s1} flex={1} style={{ minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              ...fUi(600),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.ink,
            }}
          >
            {plan.title}
          </Text>
          <Row gap={m.s2} align="baseline">
            {/* THE PRICE IS THE NUMBER THE CARD IS ABOUT, so it takes the
                number face and the tight tracking every figure in this app
                takes — a price set as a label reads as a caption. */}
            <Text
              style={{
                ...fNum(700),
                fontSize: m.fsLg,
                letterSpacing: ls(m.fsLg, LS_TIGHT),
                color: t.ink,
              }}
            >
              {plan.priceText}
            </Text>
            <Text
              style={{
                ...fUi(400),
                fontSize: m.fsXs,
                letterSpacing: ls(m.fsXs, LS_MICRO),
                color: t.ink3,
              }}
            >
              {plan.per}
            </Text>
          </Row>
        </Col>

        <Col gap={m.s1} align="flex-end" style={{ flexShrink: 0 }}>
          {!!plan.badge && (
            <View
              style={{
                borderRadius: m.rSm,
                backgroundColor: t.accent,
                paddingVertical: m.s1,
                paddingHorizontal: m.s2,
              }}
            >
              <Text
                style={{
                  ...fUi(700),
                  fontSize: m.fs2xs,
                  letterSpacing: ls(m.fs2xs, LS_CAPS),
                  textTransform: 'uppercase',
                  // the badge is an INVERTED SURFACE and carries both halves —
                  // an accent fill with accent ink is the slab this app keeps
                  // catching itself drawing
                  color: t.accentInk,
                }}
              >
                {plan.badge}
              </Text>
            </View>
          )}
          {!!plan.note && (
            <Text
              style={{
                ...fUi(400),
                fontSize: m.fsXs,
                letterSpacing: ls(m.fsXs, LS_MICRO),
                color: t.ink3,
              }}
            >
              {plan.note}
            </Text>
          )}
        </Col>
      </Row>
    </Press>
  );
}

export default function PaywallScreen() {
  return (
    <DarkRoom>
      <Paywall />
    </DarkRoom>
  );
}

function Paywall() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const billing = usePurchaseOptions();

  /**
   * THE ROUTE STILL CARRIES A `gate` AND THIS SCREEN NO LONGER READS IT.
   *
   * `showPaywall(gate)` is unchanged, so which door the scorer came through
   * is still in the URL — it is simply not printed any more, because the
   * headline is one fixed sentence rather than a line per gate. Naming the
   * room is `components/ui/Locked.tsx`'s job now, and it is the screen the
   * scorer was actually standing in. Putting the line back is one block
   * here and no plumbing anywhere.
   */

  /**
   * THE HEADLINE'S SIZE IS DECIDED BY WIDTH AS WELL AS BY HEIGHT, and it is
   * the SECOND step in the app that is — `fsFtr` is the other, and for the
   * same reason: a string of a known length has to fit a box of a known
   * width, and a ramp computed off the window HEIGHT knows nothing about
   * width. A tall narrow phone is exactly where that bites: at 360 × 950
   * even `fs2xl` reaches about 40pt against 328pt of measure, and
   * `Upgrade to access` wraps to two lines.
   *
   * So the available measure divided by `HEAD_EM` is the largest size that
   * CANNOT wrap, and `fs2xl` is the ceiling on top of it — without that a
   * tablet would draw the line 74pt tall simply because it had the room.
   * The result is big where there is width for it and smaller where there
   * is not, on one line either way.
   */
  const headFs = Math.min(m.fs2xl, (Math.min(m.win.w, MEASURE) - m.s4 * 2) / HEAD_EM);

  const [picked, setPicked] = useState<Plan['key']>(DEFAULT_PLAN);
  const plans: StorePlan[] = billing.packages.map(pkg => ({
    key: pkg.packageType === 'ANNUAL' ? 'yearly' : 'monthly',
    title: pkg.packageType === 'ANNUAL' ? 'Yearly' : 'Monthly',
    per: pkg.packageType === 'ANNUAL' ? 'per year' : 'per month',
    priceText: pkg.product.priceString,
  }));
  const plan = plans.find(p => p.key === picked) ?? plans[0];
  const selectedPackage = billing.packages.find(pkg => (pkg.packageType === 'ANNUAL' ? 'yearly' : 'monthly') === plan?.key);

  const close = (): void => {
    // BACK, NOT `replace('/')`: this opens OVER whatever the scorer was doing —
    // the lobby, a saved game, a competition page — and closing it has to put
    // them back on that screen rather than sending them home from wherever
    // they happened to be. `canGoBack` is the deep-link case: launched
    // straight onto the paywall there is nothing behind it.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const buy = async (): Promise<void> => {
    if (selectedPackage && await billing.transact(selectedPackage)) close();
  };
  const restore = async (): Promise<void> => {
    if (await billing.transact()) close();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* the photograph, then the bloom on top of it — one light on one
          surface, the order the lobby uses */}
      <HeroArt height={m.win.h * ART_H} />
      <Bloom />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: safe.top + m.s2,
          paddingBottom: safe.bottom + m.s5,
          paddingHorizontal: m.s4,
          // the verb is pinned to the bottom of a SHORT page and flows on a
          // long one, which is what `flexGrow` buys: a paywall on a tall phone
          // should not leave the button floating in the middle of the screen
          flexGrow: 1,
        }}
      >
        {/* ---- the close ------------------------------------------------ *
            TOP LEFT AND OVER THE PICTURE, where the reference puts it. It is
            the first thing in the flow rather than absolutely positioned so
            that the headline below it cannot ever slide under it on a window
            nobody tested.                                                  */}
        <Row justify="flex-start">
          <Press
            accessibilityLabel="Close"
            onPress={close}
            style={{
              width: m.tap,
              height: m.tap,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -m.s2,
            }}
            pressedStyle={{ opacity: 0.5 }}
          >
            <MaterialCommunityIcons name="close" size={m.fsLg} color={t.ink2} />
          </Press>
        </Row>

        {/* the picture owns the top of the screen, so the type starts below it */}
        <View style={{ height: m.win.h * ART_H - m.tap - safe.top - m.s2 }} />

        <Col gap={m.s5} style={{ width: '100%', maxWidth: MEASURE, alignSelf: 'center' }}>
          {/* ---- THE HEADLINE: ONE BIG LIT VERB, CENTRED, ONE LINE ---- *
              It replaced two things at once — the small caps line naming the
              gate that opened this (UNLOCK YOUR SEASON, UNLOCK THE PDF EXPORT)
              and the two-line headline under it. Three stacked messages above
              the fold is three things to read before the offer; this is one.

              IT IS THE OFFER'S OWN SENTENCE AND IT DOES NOT CHANGE. The
              per-gate line was the wall explaining itself, and that job now
              belongs entirely to `components/ui/Locked.tsx`, which is the DOOR
              the scorer came through and still names the room it guards — so
              the two screens say different things one tap apart rather than
              the same thing twice. The route still CARRIES the gate;
              `showPaywall(gate)` is unchanged and this screen simply no longer
              prints it, so putting the line back is one block and no plumbing.

              CENTRED, against the benefits and cards below it, which stay left.
              A headline that is the only thing on its own line reads as a
              banner; the list under it reads as a list.

              `GlowText` IS THE GRADIENT, and it is the app's own — `orangeHot`
              settling into the accent, two SOLID stops because that ramp is a
              MASK and a transparent stop would erase the end of a glyph.
              Handing it `t.accent` is what arms it: `GlowText` renders a plain
              `Text` unless the ink it is given IS the accent. On web it falls
              back to flat orange, because `react-native-web` has no honest
              mask.

              IT IS THE BODY FACE, NOT `fDisplay`. The display face is spent on
              the wordmark and the crest's monogram; a sentence set in the
              app's logotype reads as a poster shouting rather than as a screen
              talking.                                                       */}
          <GlowText
            containerStyle={{ width: '100%' }}
            // ONE LINE IS THE POINT, and this is the guarantee rather than the
            // mechanism: `headFs` is already the largest size that cannot wrap,
            // so this only catches a face whose metrics are wider than the one
            // `HEAD_EM` was measured on.
            numberOfLines={1}
            style={{
              textAlign: 'center',
              ...fUi(700),
              fontSize: headFs,
              // Anton is not in play here, but a headline step still needs its
              // leading brought down from the body default or the line box is
              // taller than the type sitting in it
              lineHeight: headFs * 1.14,
              letterSpacing: ls(headFs, LS_TITLE),
              color: t.accent,
            }}
          >
            Upgrade to access
          </GlowText>

          {/* ---- what the money buys ---------------------------------- */}
          <Col gap={m.s3}>
            {BENEFITS.map((b) => (
              <Benefit key={b.bold} {...b} />
            ))}
          </Col>

          {/* ---- the plans -------------------------------------------- */}
          <Col gap={m.s2}>
            {plans.map((p) => (
              <PlanCard
                key={p.key}
                plan={p}
                selected={p.key === plan?.key}
                onPress={() => setPicked(p.key)}
              />
            ))}
          </Col>
        </Col>

        {/* the flexible gap is what pins the verb low on a short page and lets
            it flow on a long one */}
        <View style={{ flex: 1, minHeight: m.s4 }} />

        <Col gap={m.s2} style={{ width: '100%', maxWidth: MEASURE, alignSelf: 'center' }}>
          {/* THE VERB TAKES `bloom`, which is the variant for a button that
              STARTS something — the same one CONTINUE GAME and START GAME
              wear. It is the accent filled with the room's own gradient, so
              the one control that matters belongs to the screen behind it
              rather than sitting on it as a slab. */}
          <Row align="stretch">
            <Btn label={billing.busy ? 'Please wait…' : billing.loading ? 'Loading plans…' : plan ? `Unlock — ${plan.priceText} ${plan.per}` : 'Subscriptions unavailable'} variant="bloom" onPress={() => void buy()} disabled={billing.loading || billing.busy || !selectedPackage} />
          </Row>

          {(privacyUrl || termsUrl) && <Row>
            {privacyUrl && <Btn label="Privacy policy" variant="plain" onPress={() => { void Linking.openURL(privacyUrl).catch(() => {}); }} />}
            {termsUrl && <Btn label="Terms of use" variant="plain" onPress={() => { void Linking.openURL(termsUrl).catch(() => {}); }} />}
          </Row>}
          {!billing.unavailable && <Row>
            <Btn label="Restore purchases" variant="plain" onPress={() => void restore()} disabled={billing.busy} />
            <Btn label="Reload plans" variant="plain" onPress={() => void billing.reload()} disabled={billing.busy || billing.loading} />
          </Row>}
          <Text
            style={{
              textAlign: 'center',
              ...fUi(400),
              fontSize: m.fs2xs,
              letterSpacing: ls(m.fs2xs, LS_MICRO),
              color: t.ink3,
            }}
          >
            {billing.message || 'Subscriptions renew automatically unless cancelled in your store account. Your saved games stay on your device.'}
          </Text>
        </Col>
      </ScrollView>
    </View>
  );
}
