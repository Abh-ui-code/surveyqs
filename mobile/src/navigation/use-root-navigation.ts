import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "./types";

/** Tab screens sit inside the root stack, so this reaches the pushed
 * interview screens (RespondentCapture, FormSection, ...) from any tab. */
export function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}
