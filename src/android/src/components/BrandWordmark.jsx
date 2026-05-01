import { Text, View, StyleSheet } from 'react-native'

export default function BrandWordmark({ size = 24, centered = false, muted = false }) {
  return (
    <View style={[s.wrap, centered && s.centered]}>
      <Text style={[
        s.light,
        { fontSize: size, lineHeight: Math.round(size * 1.16) },
        muted && s.muted,
      ]}>
        Light
      </Text>
      <Text style={[
        s.scan,
        { fontSize: size, lineHeight: Math.round(size * 1.16) },
        muted && s.scanMuted,
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
    color: '#f6f7f9',
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: 0,
  },
  scan: {
    color: '#4d78ff',
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0,
  },
  muted: { color: 'rgba(255,255,255,0.86)' },
  scanMuted: { color: '#7fa0ff' },
})
