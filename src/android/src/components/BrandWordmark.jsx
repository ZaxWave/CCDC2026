import { Text, View, StyleSheet } from 'react-native'
import { useTheme } from '../theme'

export default function BrandWordmark({ size = 24, centered = false, muted = false }) {
  const theme = useTheme()
  const lightColor = muted ? theme.textSoft : theme.text
  const scanColor = muted ? theme.blueText : theme.blue

  return (
    <View style={[s.wrap, centered && s.centered]}>
      <Text style={[
        s.light,
        { fontSize: size, lineHeight: Math.round(size * 1.16) },
        { color: lightColor },
      ]}>
        Light
      </Text>
      <Text style={[
        s.scan,
        { fontSize: size, lineHeight: Math.round(size * 1.16) },
        { color: scanColor },
      ]}>
        Scan
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'baseline' },
  centered: { justifyContent: 'center' },
  light: {
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: 0,
  },
  scan: {
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0,
  },
})
