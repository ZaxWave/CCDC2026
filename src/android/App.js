import { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import HomeScreen from './src/screens/HomeScreen'
import LoginScreen from './src/screens/LoginScreen'
import ReportScreen from './src/screens/citizen/ReportScreen'
import HubScreen from './src/screens/worker/HubScreen'
import IssuesScreen from './src/screens/worker/IssuesScreen'
import RecordScreen from './src/screens/worker/RecordScreen'
import OnboardingScreen from './src/screens/OnboardingScreen'
import { NetworkProvider } from './src/context/NetworkContext'

const Stack = createNativeStackNavigator()

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null)

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then(val => {
      setInitialRoute(val ? 'Home' : 'Onboarding')
    })
  }, [])

  if (!initialRoute) return null

  return (
    <NetworkProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Home"      component={HomeScreen} />
          <Stack.Screen name="Login"     component={LoginScreen} />
          <Stack.Screen name="Report"    component={ReportScreen} />
          <Stack.Screen name="WorkerHub" component={HubScreen} />
          <Stack.Screen name="Issues"    component={IssuesScreen} />
          <Stack.Screen name="Record"    component={RecordScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </NetworkProvider>
  )
}
