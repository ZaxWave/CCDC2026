import { View, Text, Image, ScrollView, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import styles from './index.module.scss'

export default function CitizenReport() {
  const [selectedType, setSelectedType] = useState('坑槽')
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)

  const types = [
    { label: '坑槽', icon: '🕳️' },
    { label: '裂缝', icon: '〰️' },
    { label: '拥包', icon: '⛰️' },
    { label: '沉陷', icon: '📉' },
    { label: '车辙', icon: '🛤️' },
    { label: '其他', icon: '❓' }
  ]

  const goBack = () => Taro.navigateBack()

  const handleAddPhoto = async () => {
    const res = await Taro.chooseMedia({ count: 9 - photos.length, mediaType: ['image'] })
    setPhotos([...photos, ...res.tempFiles.map(f => f.tempFilePath)])
  }

  const removePhoto = (index) => {
    const newPhotos = [...photos]
    newPhotos.splice(index, 1)
    setPhotos(newPhotos)
  }

  const handleSubmit = () => {
    setLoading(true)
    Taro.showLoading({ title: '上报中...' })
    setTimeout(() => {
      Taro.hideLoading()
      setLoading(false)
      Taro.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    }, 1500)
  }

  return (
    <View className={styles.page}>
      {/* 修改后的 Header：加入了返回按钮 */}
      <View className={styles.header}>
        <View className={styles.headerLeft}>
          <View className={styles.backBtn} onClick={goBack}>
            <Text className={styles.backIcon}>‹</Text>
          </View>
          <Text className={styles.headerTitle}>问题上报</Text>
        </View>
        <Text className={styles.headerSub}>随手拍</Text>
      </View>

      <ScrollView scrollY className={styles.bodyScroll}>
        <View className={styles.body}>
          {/* 病害类型区块 */}
          <View className={styles.section}>
            <View className={styles.secHeader}>
              <Text className={styles.secLabel}>病害类型</Text>
              <Text className={styles.secNote}>必选</Text>
            </View>
            <View className={styles.typeGrid}>
              {types.map(t => (
                <View 
                  key={t.label}
                  className={`${styles.typeItem} ${selectedType === t.label ? styles.typeItemActive : ''}`}
                  onClick={() => setSelectedType(t.label)}
                >
                  <Text className={styles.typeItemIcon}>{t.icon}</Text>
                  <Text className={styles.typeItemLabel}>{t.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 照片区块 */}
          <View className={styles.section}>
            <View className={styles.secHeader}>
              <Text className={styles.secLabel}>现场照片</Text>
              <Text className={styles.secNote}>{photos.length}/9</Text>
            </View>
            <View className={styles.photoGrid}>
              {photos.map((p, i) => (
                <View key={p} className={styles.photoCell}>
                  <Image src={p} mode='aspectFill' className={styles.photoImg} />
                  <View className={styles.photoRemove} onClick={() => removePhoto(i)}>
                    <Text className={styles.removeX}>×</Text>
                  </View>
                </View>
              ))}
              {photos.length < 9 && (
                <View className={styles.photoAdd} onClick={handleAddPhoto}>
                  <Text className={styles.addPlus}>+</Text>
                  <Text className={styles.addLabel}>添加照片</Text>
                </View>
              )}
            </View>
          </View>

          {/* 描述区块 */}
          <View className={styles.section}>
            <Textarea 
              className={styles.textarea} 
              placeholder='请简要描述路面情况...' 
              placeholderClass={styles.ph}
            />
            <Text className={styles.charCount}>0/200</Text>
          </View>

          {/* 提交按钮 */}
          <View 
            className={`${styles.submitBtn} ${loading ? styles.submitBtnLoading : ''}`}
            onClick={handleSubmit}
          >
            <Text className={styles.submitText}>提交</Text>
          </View>
          
          <Text className={styles.privacy}>
            提交即代表您同意《LightScan 众包协议》{"\n"}系统将自动记录您的地理位置
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}