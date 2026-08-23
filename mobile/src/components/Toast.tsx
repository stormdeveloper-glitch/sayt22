import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Animated, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onHide: () => void;
}

export const Toast: React.FC<ToastProps> = ({ visible, message, type = 'info', onHide }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: insets.top + 10,
        useNativeDriver: true,
        bounciness: 8,
      }).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, 3500);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, insets.top]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onHide();
    });
  };

  if (!visible && message === '') return null;

  const getStyle = () => {
    let backgroundColor = colors.primary;
    let iconName: keyof typeof Ionicons.prototype.props.name = 'information-circle-outline';

    switch (type) {
      case 'success':
        backgroundColor = colors.success;
        iconName = 'checkmark-circle-outline';
        break;
      case 'error':
        backgroundColor = colors.danger;
        iconName = 'alert-circle-outline';
        break;
    }

    return { backgroundColor, iconName };
  };

  const currentTheme = getStyle();

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: currentTheme.backgroundColor,
        },
      ]}
    >
      <Ionicons name={currentTheme.iconName as any} size={22} color="#ffffff" style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 9999,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
});
export default Toast;
