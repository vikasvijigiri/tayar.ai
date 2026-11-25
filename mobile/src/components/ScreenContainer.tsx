import React, { ReactNode } from "react";
import {
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { colors } from "../theme/tokens";

type ScreenContainerProps = Pick<
  ScrollViewProps,
  | "contentContainerStyle"
  | "keyboardShouldPersistTaps"
  | "onScroll"
  | "refreshControl"
  | "scrollEnabled"
  | "showsVerticalScrollIndicator"
  | "testID"
> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Consistent, keyboard-safe scrolling surface for all app screens. */
export function ScreenContainer({
  children,
  style,
  contentContainerStyle,
  keyboardShouldPersistTaps = "handled",
  showsVerticalScrollIndicator = false,
  ...scrollProps
}: ScreenContainerProps) {
  return (
    <ScrollView
      {...scrollProps}
      style={[styles.base, style]}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardDismissMode="on-drag"
      overScrollMode="never"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, backgroundColor: colors.background },
});
