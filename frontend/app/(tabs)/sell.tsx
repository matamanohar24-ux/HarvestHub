import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Constants from 'expo-constants';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const CATEGORIES = [
  { label: 'Vegetables', value: 'Vegetables', icon: 'carrot', color: '#22c55e' },
  { label: 'Fruits', value: 'Fruits', icon: 'food-apple', color: '#ef4444' },
  { label: 'Herbs', value: 'Herbs', icon: 'leaf', color: '#10b981' },
  { label: 'Grains', value: 'Grains', icon: 'barley', color: '#a3e635' },
  { label: 'Dairy', value: 'Dairy', icon: 'cheese', color: '#f97316' },
  { label: 'Eggs', value: 'Eggs', icon: 'egg', color: '#f59e0b' },
  { label: 'Honey', value: 'Honey', icon: 'beehive-outline', color: '#eab308' },
  { label: 'Other', value: 'Other', icon: 'dots-horizontal', color: '#6b7280' },
];

const UNITS = [
  { label: 'lbs', value: 'lbs' },
  { label: 'kg', value: 'kg' },
  { label: 'pieces', value: 'pieces' },
  { label: 'dozen', value: 'dozen' },
  { label: 'bunch', value: 'bunch' },
  { label: 'oz', value: 'oz' },
];

export default function SellScreen() {
  const { sessionToken, user } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Vegetables');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('lbs');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const selectedCategory = CATEGORIES.find(c => c.value === category);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert('Permission required', 'Camera and photo library access is needed');
      return false;
    }
    return true;
  };

  const pickImage = async (useCamera: boolean) => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
            base64: true,
          });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setPhotos([...photos, base64Image]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter product name');
      return;
    }

    if (!price || isNaN(parseFloat(price))) {
      Alert.alert('Error', 'Please enter valid price');
      return;
    }

    if (!quantity || isNaN(parseFloat(quantity))) {
      Alert.alert('Error', 'Please enter valid quantity');
      return;
    }

    if (!user?.location) {
      Alert.alert(
        'Location Required', 
        'Please set your location in your profile first to list products.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `${BACKEND_URL}/api/products`,
        {
          name: name.trim(),
          category,
          description: description.trim(),
          price: parseFloat(price),
          quantity: parseFloat(quantity),
          unit,
          photos,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      Alert.alert('Success', 'Product listed successfully!');
      // Reset form
      setName('');
      setDescription('');
      setPrice('');
      setQuantity('');
      setPhotos([]);
      setCategory('Vegetables');
      setUnit('lbs');
    } catch (error: any) {
      console.error('Error creating product:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to list product');
    } finally {
      setLoading(false);
    }
  };

  // Category Picker Modal
  const CategoryPickerModal = () => (
    <Modal
      visible={showCategoryPicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowCategoryPicker(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={CATEGORIES}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.optionItem,
                  category === item.value && styles.optionItemSelected
                ]}
                onPress={() => {
                  setCategory(item.value);
                  setShowCategoryPicker(false);
                }}
              >
                <MaterialCommunityIcons 
                  name={item.icon as any} 
                  size={24} 
                  color={item.color} 
                />
                <Text style={[
                  styles.optionLabel,
                  category === item.value && styles.optionLabelSelected
                ]}>
                  {item.label}
                </Text>
                {category === item.value && (
                  <MaterialCommunityIcons name="check" size={20} color="#10b981" />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Unit Picker Modal
  const UnitPickerModal = () => (
    <Modal
      visible={showUnitPicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowUnitPicker(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowUnitPicker(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Unit</Text>
            <TouchableOpacity onPress={() => setShowUnitPicker(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={UNITS}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.optionItem,
                  unit === item.value && styles.optionItemSelected
                ]}
                onPress={() => {
                  setUnit(item.value);
                  setShowUnitPicker(false);
                }}
              >
                <Text style={[
                  styles.optionLabel,
                  unit === item.value && styles.optionLabelSelected
                ]}>
                  {item.label}
                </Text>
                {unit === item.value && (
                  <MaterialCommunityIcons name="check" size={20} color="#10b981" />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        enableOnAndroid
        extraScrollHeight={20}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons name="tag" size={32} color="#10b981" />
          <Text style={styles.headerTitle}>List Your Product</Text>
          <Text style={styles.headerSubtitle}>Share your harvest with the community</Text>
        </View>

        <View style={styles.form}>
          {/* Product Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Fresh Tomatoes"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Category Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowCategoryPicker(true)}
            >
              <View style={styles.pickerButtonContent}>
                {selectedCategory && (
                  <MaterialCommunityIcons 
                    name={selectedCategory.icon as any} 
                    size={20} 
                    color={selectedCategory.color} 
                  />
                )}
                <Text style={styles.pickerButtonText}>{category}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your product (freshness, growing method, etc.)"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Price and Quantity Row */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfInput]}>
              <Text style={styles.label}>Price ($) *</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="5.00"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfInput]}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="10"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Unit Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unit</Text>
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowUnitPicker(true)}
            >
              <Text style={styles.pickerButtonText}>{unit}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Photos */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photos</Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoButton} onPress={() => pickImage(true)}>
                <MaterialCommunityIcons name="camera" size={24} color="#10b981" />
                <Text style={styles.photoButtonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.photoButton} onPress={() => pickImage(false)}>
                <MaterialCommunityIcons name="image" size={24} color="#10b981" />
                <Text style={styles.photoButtonText}>Choose Photo</Text>
              </TouchableOpacity>
            </View>

            {photos.length > 0 && (
              <ScrollView horizontal style={styles.photosContainer} showsHorizontalScrollIndicator={false}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoWrapper}>
                    <Image source={{ uri: photo }} style={styles.photo} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removePhoto(index)}
                    >
                      <MaterialCommunityIcons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
                <Text style={styles.submitButtonText}>List Product</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

      <CategoryPickerModal />
      <UnitPickerModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  textArea: {
    height: 100,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f9fafb',
  },
  pickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    backgroundColor: '#f0fdf4',
  },
  photoButtonText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  photosContainer: {
    marginTop: 12,
  },
  photoWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  submitButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  optionItemSelected: {
    backgroundColor: '#f0fdf4',
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  optionLabelSelected: {
    color: '#10b981',
    fontWeight: '600',
  },
});
