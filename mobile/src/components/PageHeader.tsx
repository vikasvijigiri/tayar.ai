import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme/tokens";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  compact?: boolean;
};

/** Shared accessible heading hierarchy for learner-facing screens. */
export function PageHeader({ eyebrow, title, description, compact = false }: PageHeaderProps) {
  return (
    <View style={styles.container} accessible={false}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 0 },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: typography.caption - 1,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 10,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 35,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1,
  },
  titleCompact: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 22,
  },
});
