import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';

const { width } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onFinish: () => void;
  minDisplayTimeMs?: number;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  isReady,
  onFinish,
  minDisplayTimeMs = 1800,
}) => {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const isExitingRef = useRef(false);

  // Animation values
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(14)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(10)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  // Master exit animation
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  // 1. Trigger entrance animations
  useEffect(() => {
    // Entrance choreography
    Animated.parallel([
      // Logo spring and fade-in
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),

      // Staggered Title
      Animated.sequence([
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Staggered Subtitle
      Animated.sequence([
        Animated.delay(380),
        Animated.parallel([
          Animated.timing(subtitleTranslateY, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Sleek progress line fill
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]),

      // Footer fade
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Subtle continuous breathing aura
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Minimum display timer
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDisplayTimeMs);

    return () => clearTimeout(timer);
  }, []);

  // 2. Trigger exit when both minimum display time has elapsed and app is ready
  useEffect(() => {
    if (minTimeElapsed && isReady && !isExitingRef.current) {
      isExitingRef.current = true;
      Animated.parallel([
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: 1.05,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onFinish();
      });
    }
  }, [minTimeElapsed, isReady]);

  // Interpolations
  const auraScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.28],
  });

  const auraOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: exitOpacity,
          transform: [{ scale: exitScale }],
        },
      ]}
      pointerEvents="auto"
    >
      <View style={styles.centerContent}>
        {/* Breathing Halo / Aura behind logo */}
        <Animated.View
          style={[
            styles.aura,
            {
              transform: [{ scale: auraScale }],
              opacity: auraOpacity,
            },
          ]}
        />

        {/* Authentic Crystal Martin Monogram Badge (No external image) */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoCard}>
            <Text style={styles.monogramText}>CM</Text>
          </View>
        </Animated.View>

        {/* Enterprise Brand Typography */}
        <View style={styles.textContainer}>
          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            }}
          >
            <Text style={styles.companyName}>CRYSTAL MARTIN</Text>
          </Animated.View>

          <Animated.View
            style={{
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }],
            }}
          >
            <Text style={styles.systemTitle}>ASSETS MANAGEMENT & AUDITING</Text>
          </Animated.View>
        </View>

        {/* Modern Indeterminate Loading Track */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressWidth,
              },
            ]}
          />
        </View>
      </View>

      {/* Enterprise Security & Version Footer */}
      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <Text style={styles.footerBadge}>ENTERPRISE ASSET TRACKING</Text>
        <Text style={styles.footerVersion}>Crystal Martin Group • v1.0.1</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 99999,
    paddingVertical: 50,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  aura: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#dbeafe', // Gentle sky tint
  },
  logoContainer: {
    marginBottom: 28,
  },
  logoCard: {
    width: 124,
    height: 124,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#1e3a8a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  monogramText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: 2,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  companyName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 3.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  systemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb', // Enterprise Royal Blue
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  progressTrack: {
    width: Math.min(width * 0.45, 180),
    height: 3,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    marginTop: 36,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },
  footer: {
    alignItems: 'center',
  },
  footerBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 10,
    color: '#cbd5e1',
    fontWeight: '500',
  },
});
