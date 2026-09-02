import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const { colors } = useTheme();
  const scaleValue = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getStyles = () => {
    const baseStyle: ViewStyle = {
      backgroundColor: colors.primary,
      borderColor: 'transparent',
      borderWidth: 0,
    };
    const baseText: TextStyle = {
      color: '#ffffff',
    };

    switch (variant) {
      case 'secondary':
        baseStyle.backgroundColor = colors.primaryLight;
        baseText.color = colors.primary;
        break;
      case 'danger':
        baseStyle.backgroundColor = colors.danger;
        break;
      case 'success':
        baseStyle.backgroundColor = colors.success;
        break;
      case 'outline':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderColor = colors.border;
        baseStyle.borderWidth = 1.5;
        baseText.color = colors.text;
        break;
    }

    if (disabled || loading) {
      baseStyle.opacity = 0.6;
    }

    return { button: baseStyle, text: baseText };
  };

  const currentStyles = getStyles();

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }], width: style?.width || '100%' }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[styles.btn, currentStyles.button, style]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'outline' || variant === 'secondary' ? colors.primary : '#ffffff'} />
        ) : (
          <Text style={[styles.text, currentStyles.text, textStyle]}>{title}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
export default Button;
