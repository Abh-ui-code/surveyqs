import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { useIsAuthActive } from "@/lib/auth-store";

import LoginScreen from "@/screens/auth/LoginScreen";
import SurveysScreen from "@/screens/home/SurveysScreen";
import MyWorkScreen from "@/screens/home/MyWorkScreen";
import SyncScreen from "@/screens/home/SyncScreen";
import ProfileScreen from "@/screens/home/ProfileScreen";
import RespondentCaptureScreen from "@/screens/interview/RespondentCaptureScreen";
import FormSectionScreen from "@/screens/interview/FormSectionScreen";
import ReviewSubmitScreen from "@/screens/interview/ReviewSubmitScreen";
import ResponseDetailScreen from "@/screens/home/ResponseDetailScreen";
import { useOutbox } from "@/hooks/use-outbox";

import type { RootStackParamList, TabParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  const { colors } = useTheme();
  const outbox = useOutbox();
  const pending = (outbox.data ?? []).filter((e) => e.status !== "done").length;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Surveys" component={SurveysScreen} options={{ tabBarLabel: "Surveys", tabBarIcon: () => <TabIcon emoji="📋" /> }} />
      <Tab.Screen name="MyWork" component={MyWorkScreen} options={{ tabBarLabel: "My Work", tabBarIcon: () => <TabIcon emoji="📊" /> }} />
      <Tab.Screen
        name="Sync"
        component={SyncScreen}
        options={{ tabBarLabel: "Sync", tabBarIcon: () => <TabIcon emoji="🔄" />, tabBarBadge: pending > 0 ? pending : undefined }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: "Profile", tabBarIcon: () => <TabIcon emoji="👤" /> }} />
    </Tab.Navigator>
  );
}

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}

/**
 * Two screen groups, switched on auth state. `useIsAuthActive` only ever
 * flips synchronously (see lib/auth-store.ts) — there is no "still
 * resolving" window during which a screen set would be wrong, so this
 * simpler two-branch form is safe (a fully async permissions fetch, like
 * the web app's, is the case that needs every route registered up front).
 */
export function RootNavigator() {
  const isAuthActive = useIsAuthActive();
  const { colors } = useTheme();

  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerShadowVisible: false }}>
      {!isAuthActive ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="RespondentCapture" component={RespondentCaptureScreen} options={{ title: "Respondent" }} />
          <Stack.Screen name="FormSection" component={FormSectionScreen} options={{ title: "" }} />
          <Stack.Screen name="ReviewSubmit" component={ReviewSubmitScreen} options={{ title: "Review" }} />
          <Stack.Screen name="ResponseDetail" component={ResponseDetailScreen} options={{ title: "Response" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
