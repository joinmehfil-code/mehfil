/**
 * Aurora — an animated "night mehfil" background of drifting, blurred colour
 * orbs rendered with react-native-svg + reanimated. Purely decorative; place it
 * absolutely behind hero sections, auth screens and headers.
 */
import { Dimensions, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Orb = {
  color: string;
  r: number;
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  dur: number;
  delay: number;
};

const ORBS: Orb[] = [
  { color: '#00E5A0', r: W * 0.55, cx: W * 0.15, cy: H * 0.1, dx: 40, dy: -30, dur: 9000, delay: 0 },
  { color: '#A855F7', r: W * 0.5, cx: W * 0.9, cy: H * 0.2, dx: -46, dy: 34, dur: 11000, delay: 800 },
  { color: '#FFC65C', r: W * 0.45, cx: W * 0.5, cy: H * 0.95, dx: 30, dy: -40, dur: 13000, delay: 1600 },
];

function AuroraOrb({ orb, opacity }: { orb: Orb; opacity: number }) {
  const t = useSharedValue(0);
  t.value = withRepeat(
    withSequence(
      withTiming(1, { duration: orb.dur, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: orb.dur, easing: Easing.inOut(Easing.ease) }),
    ),
    -1,
    false,
  );
  const id = `g-${orb.color.replace('#', '')}`;
  const props = useAnimatedProps(() => ({
    cx: orb.cx + t.value * orb.dx,
    cy: orb.cy + t.value * orb.dy,
  }));
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={orb.color} stopOpacity={opacity} />
          <Stop offset="100%" stopColor={orb.color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <AnimatedCircle animatedProps={props} r={orb.r} fill={`url(#${id})`} />
    </>
  );
}

export function Aurora({
  style,
  opacity = 0.5,
}: {
  style?: StyleProp<ViewStyle>;
  opacity?: number;
}) {
  return (
    <View pointerEvents="none" style={[styles.wrap, style]}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        {ORBS.map((orb) => (
          <AuroraOrb key={orb.color} orb={orb} opacity={opacity} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
