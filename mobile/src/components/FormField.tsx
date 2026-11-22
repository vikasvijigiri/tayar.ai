import React from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

type FormFieldProps = Pick<
  TextInputProps,
  | "value"
  | "onChangeText"
  | "placeholder"
  | "keyboardType"
  | "textContentType"
  | "autoCapitalize"
  | "autoCorrect"
  | "editable"
  | "onSubmitEditing"
  | "returnKeyType"
  | "maxLength"
  | "accessibilityLabel"
  | "accessibilityHint"
  | "testID"
>;

export function FormField({
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  textContentType,
  autoCapitalize = "none",
  autoCorrect = false,
  editable = true,
  onSubmitEditing,
  returnKeyType = "done",
  maxLength,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: FormFieldProps) {
  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        textContentType={textContentType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        maxLength={maxLength}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole="text"
        testID={testID}
        selectionColor={colors.accentPrimary}
        cursorColor={colors.accentPrimary}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.body,
    fontWeight: "600",
  },
});
