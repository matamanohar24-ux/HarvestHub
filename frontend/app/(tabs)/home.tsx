import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Product {
  product_id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  unit: string;
  photos: string[];
  description?: string;
  distance?: number;
  seller_id: string;
  seller?: {
    user_id: string;
    name: string;
    profile_photo?: string;
    rating: number;
  };
}

const CATEGORIES = [
  { name: 'All', icon: 'view-grid', color: '#6b7280' },
  { name: 'Vegetables', icon: 'carrot', color: '#22c55e' },
  { name: 'Fruits', icon: 'food-apple', color: '#ef4444' },
  { name: 'Herbs', icon: 'leaf', color: '#10b981' },
  { name: 'Eggs', icon: 'egg', color: '#f59e0b' },
  { name: 'Honey', icon: 'beehive-outline', color: '#eab308' },
  { name: 'Dairy', icon: 'cheese', color: '#f97316' },
  { name: 'Grains', icon: 'barley', color: '#a3e635' },
];

const RADIUS_OPTIONS = [5, 10, 15, 20, 30];

export default function HomeScreen() {
  const { sessionToken, user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRadius, setSelectedRadius] = useState(10);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      loadProducts();
    }
  }, [userLocation, selectedCategory, selectedRadius]);

  const getUserLocation = async () => {
    try {
      if (user?.location) {
        setUserLocation({ lat: user.location.lat, lng: user.location.lng });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        } else {
          // Default location if permission denied
          setUserLocation({ lat: 40.7128, lng: -74.0060 });
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setUserLocation({ lat: 40.7128, lng: -74.0060 });
    }
  };

  const loadProducts = async () => {
    if (!userLocation) return;
    
    try {
      setLoading(true);
      const categoryParam = selectedCategory !== 'All' ? `&category=${selectedCategory}` : '';
      const response = await axios.get(
        `${BACKEND_URL}/api/products?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${selectedRadius}&limit=50${categoryParam}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts();
  }, [userLocation, selectedCategory, selectedRadius]);

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProductPress = (product: Product) => {
    router.push(`/product/${product.product_id}`);
  };

  const handleChatWithSeller = (sellerId: string) => {
    router.push(`/chat/${sellerId}`);
  };

  const renderProductCard = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => handleProductPress(item)}
    >
      <View style={styles.productImageContainer}>
        {item.photos && item.photos.length > 0 ? (
          <Image source={{ uri: item.photos[0] }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder]}>
            <MaterialCommunityIcons name="image-off" size={40} color="#d1d5db" />
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.category}</Text>
        </View>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.productPrice}>${item.price.toFixed(2)}/{item.unit}</Text>
        
        <View style={styles.sellerInfo}>
          <TouchableOpacity 
            style={styles.sellerDetails}
            onPress={() => router.push(`/user/${item.seller?.user_id || item.seller_id}`)}
          >
            {item.seller?.profile_photo ? (
              <Image source={{ uri: item.seller.profile_photo }} style={styles.sellerAvatar} />
            ) : (
              <View style={[styles.sellerAvatar, styles.avatarPlaceholder]}>
                <MaterialCommunityIcons name="account" size={12} color="#9ca3af" />
              </View>
            )}
            <Text style={styles.sellerName} numberOfLines={1}>{item.seller?.name || 'Seller'}</Text>
          </TouchableOpacity>
          <View style={styles.ratingContainer}>
            <MaterialCommunityIcons name="star" size={12} color="#fbbf24" />
            <Text style={styles.ratingText}>{item.seller?.rating?.toFixed(1) || '5.0'}</Text>
          </View>
        </View>

        <View style={styles.productFooter}>
          {item.distance !== undefined && (
            <View style={styles.distanceContainer}>
              <MaterialCommunityIcons name="map-marker" size={12} color="#10b981" />
              <Text style={styles.distanceText}>{item.distance.toFixed(1)} mi</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.chatButton}
            onPress={() => handleChatWithSeller(item.seller?.user_id || item.seller_id)}
          >
            <MaterialCommunityIcons name="message-outline" size={14} color="#10b981" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="sprout" size={28} color="#10b981" />
            <Text style={styles.logoText}>HarvestHub</Text>
          </View>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <MaterialCommunityIcons name="bell-outline" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search fresh produce..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setShowRadiusPicker(!showRadiusPicker)}
          >
            <MaterialCommunityIcons name="map-marker-radius" size={18} color="#10b981" />
            <Text style={styles.actionButtonText}>{selectedRadius} mi</Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color="#10b981" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => router.push('/(tabs)/sell')}
          >
            <MaterialCommunityIcons name="plus-circle" size={18} color="#10b981" />
            <Text style={styles.actionButtonText}>Sell</Text>
          </TouchableOpacity>
        </View>
        
        {/* Radius Picker Dropdown */}
        {showRadiusPicker && (
          <View style={styles.radiusPickerContainer}>
            {RADIUS_OPTIONS.map((radius) => (
              <TouchableOpacity
                key={radius}
                style={[
                  styles.radiusOption,
                  selectedRadius === radius && styles.radiusOptionSelected
                ]}
                onPress={() => {
                  setSelectedRadius(radius);
                  setShowRadiusPicker(false);
                }}
              >
                <Text style={[
                  styles.radiusOptionText,
                  selectedRadius === radius && styles.radiusOptionTextSelected
                ]}>
                  {radius} miles
                </Text>
                {selectedRadius === radius && (
                  <MaterialCommunityIcons name="check" size={16} color="#10b981" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Categories */}
      <View style={styles.categoriesSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity 
              key={category.name} 
              style={[
                styles.categoryChip,
                selectedCategory === category.name && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(category.name)}
            >
              <MaterialCommunityIcons 
                name={category.icon as any} 
                size={18} 
                color={selectedCategory === category.name ? '#ffffff' : category.color} 
              />
              <Text style={[
                styles.categoryChipText,
                selectedCategory === category.name && styles.categoryChipTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Products List */}
      <View style={styles.productsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'All' ? 'Fresh Today' : selectedCategory}
          </Text>
          <Text style={styles.productCount}>{filteredProducts.length} items</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Finding fresh produce...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            renderItem={renderProductCard}
            keyExtractor={(item) => item.product_id}
            numColumns={2}
            columnWrapperStyle={styles.productRow}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#10b981']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="package-variant" size={64} color="#d1d5db" />
                <Text style={styles.emptyText}>No products found</Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery ? 'Try a different search' : 'Check back later or change your radius'}
                </Text>
              </View>
            }
            contentContainerStyle={filteredProducts.length === 0 ? { flex: 1 } : { paddingBottom: 16 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  notificationButton: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#1f2937',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  categoriesSection: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  productsSection: {
    flex: 1,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  productCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  productRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  productCard: {
    width: (width - 48) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImageContainer: {
    width: '100%',
    height: 130,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 8,
  },
  sellerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sellerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  sellerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  avatarPlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerName: {
    fontSize: 11,
    color: '#6b7280',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distanceText: {
    fontSize: 11,
    color: '#10b981',
  },
  chatButton: {
    padding: 6,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  radiusPickerContainer: {
    position: 'absolute',
    top: 140,
    left: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  radiusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  radiusOptionSelected: {
    backgroundColor: '#f0fdf4',
  },
  radiusOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  radiusOptionTextSelected: {
    color: '#10b981',
    fontWeight: '600',
  },
});
