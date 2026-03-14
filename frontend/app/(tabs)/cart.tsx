import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface CartItem {
  product_id: string;
  quantity: number;
  product?: {
    product_id: string;
    name: string;
    price: number;
    unit: string;
    photos: string[];
    seller_id: string;
    seller?: {
      name: string;
    };
  };
}

interface Cart {
  cart_id: string;
  user_id: string;
  items: CartItem[];
}

export default function CartScreen() {
  const { sessionToken, user } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  // Reload cart when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadCart();
    }, [sessionToken])
  );

  const loadCart = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/cart`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setCart(response.data);
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCart();
  }, []);

  const updateQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(productId);
      return;
    }

    setUpdatingItems(prev => new Set(prev).add(productId));
    try {
      await axios.put(
        `${BACKEND_URL}/api/cart/update`,
        { product_id: productId, quantity: newQuantity },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      
      // Update local state
      if (cart) {
        setCart({
          ...cart,
          items: cart.items.map(item =>
            item.product_id === productId
              ? { ...item, quantity: newQuantity }
              : item
          ),
        });
      }
    } catch (error: any) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update quantity');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const removeItem = async (productId: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUpdatingItems(prev => new Set(prev).add(productId));
            try {
              await axios.delete(`${BACKEND_URL}/api/cart/remove/${productId}`, {
                headers: { Authorization: `Bearer ${sessionToken}` },
              });
              
              // Update local state
              if (cart) {
                setCart({
                  ...cart,
                  items: cart.items.filter(item => item.product_id !== productId),
                });
              }
            } catch (error: any) {
              console.error('Error removing item:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to remove item');
            } finally {
              setUpdatingItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(productId);
                return newSet;
              });
            }
          },
        },
      ]
    );
  };

  const handleCheckout = () => {
    if (!cart || cart.items.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart before checkout');
      return;
    }
    
    // Navigate to checkout
    router.push('/checkout');
  };

  const calculateTotal = () => {
    if (!cart || !cart.items) return 0;
    return cart.items.reduce((total, item) => {
      const price = item.product?.price || 0;
      return total + price * item.quantity;
    }, 0);
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const isUpdating = updatingItems.has(item.product_id);
    const product = item.product;

    if (!product) return null;

    return (
      <View style={styles.cartItem}>
        <TouchableOpacity
          style={styles.productImageContainer}
          onPress={() => router.push(`/product/${product.product_id}`)}
        >
          {product.photos && product.photos.length > 0 ? (
            <Image source={{ uri: product.photos[0] }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.imagePlaceholder]}>
              <MaterialCommunityIcons name="image-off" size={24} color="#d1d5db" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.itemDetails}>
          <TouchableOpacity onPress={() => router.push(`/product/${product.product_id}`)}>
            <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          </TouchableOpacity>
          <Text style={styles.productPrice}>
            ${product.price.toFixed(2)} / {product.unit}
          </Text>
          {product.seller && (
            <Text style={styles.sellerName}>Sold by {product.seller.name}</Text>
          )}

          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={[styles.quantityButton, isUpdating && styles.quantityButtonDisabled]}
              onPress={() => updateQuantity(item.product_id, item.quantity - 1)}
              disabled={isUpdating}
            >
              <MaterialCommunityIcons name="minus" size={18} color="#374151" />
            </TouchableOpacity>

            <View style={styles.quantityDisplay}>
              {isUpdating ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <Text style={styles.quantityText}>{item.quantity}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.quantityButton, isUpdating && styles.quantityButtonDisabled]}
              onPress={() => updateQuantity(item.product_id, item.quantity + 1)}
              disabled={isUpdating}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.itemRight}>
          <Text style={styles.itemTotal}>
            ${(product.price * item.quantity).toFixed(2)}
          </Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeItem(item.product_id)}
            disabled={isUpdating}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const itemCount = cart?.items?.length || 0;
  const total = calculateTotal();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        <View style={styles.headerRight}>
          {itemCount > 0 && (
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{itemCount}</Text>
            </View>
          )}
        </View>
      </View>

      {itemCount === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="cart-outline" size={80} color="#d1d5db" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse products and add them to your cart
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(tabs)/home')}
          >
            <MaterialCommunityIcons name="shopping" size={20} color="#ffffff" />
            <Text style={styles.browseButtonText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart?.items || []}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.product_id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#10b981']}
              />
            }
            contentContainerStyle={styles.listContent}
          />

          {/* Checkout Footer */}
          <View style={styles.footer}>
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
              <MaterialCommunityIcons name="credit-card-outline" size={20} color="#ffffff" />
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  itemCountBadge: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  itemCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  browseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productImageContainer: {
    marginRight: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  imagePlaceholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
    marginBottom: 2,
  },
  sellerName: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityDisplay: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  removeButton: {
    padding: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
