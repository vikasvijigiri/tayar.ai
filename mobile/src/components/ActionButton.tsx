import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors, radii, spacing } from "../theme/tokens";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
};

/** Consistent, screen-reader-labelled action control for learner workflows. */
export function ActionButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  accessibilityLabel,
}: ActionButtonProps) {
  const primary = variant === "primary";
  const danger = variant === "danger";
  const spinnerColor = primary ? colors.background : danger ? colors.danger : colors.accentPrimary;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.base,
        primary ? styles.primary : danger ? styles.danger : styles.secondary,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text style={[styles.label, primary ? styles.primaryLabel : danger ? styles.dangerLabel : styles.secondaryLabel]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", borderRadius: radii.md, minHeight: 48 },
  primary: { backgroundColor: colors.accentPrimary, paddingVertical: 14, marginTop: 18 },
  secondary: { borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 14, marginTop: 12 },
  danger: { borderWidth: 1, borderColor: "#75414B", paddingVertical: 13, marginTop: spacing.lg },
  label: { fontSize: 12, fontWeight: "800" },
  primaryLabel: { color: colors.background, fontSize: 14, fontWeight: "900" },
  secondaryLabel: { color: colors.accentPrimary },
  dangerLabel: { color: "#FF9BA3", fontWeight: "900" },
  disabled: { opacity: 0.65 },
});
