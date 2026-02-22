import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useRouter, Stack } from 'expo-router';
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
  };
}

interface Cart {
  cart_id: string;
  user_id: string;
  items: CartItem[];
}

export default function CheckoutScreen() {
  const { sessionToken, user } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');

  useEffect(() => {
    loadCart();
  }, []);

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
    }
  };

  const calculateSubtotal = () => {
    if (!cart || !cart.items) return 0;
    return cart.items.reduce((total, item) => {
      const price = item.product?.price || 0;
      return total + price * item.quantity;
    }, 0);
  };

  const handlePlaceOrder = async () => {
    if (!cart || cart.items.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart before checkout');
      return;
    }

    Alert.alert(
      'Confirm Order',
      `Place order for $${calculateSubtotal().toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Place Order',
          onPress: async () => {
            try {
              setProcessing(true);
              
              // Create order for each unique seller
              const sellerItems: { [key: string]: CartItem[] } = {};
              cart.items.forEach(item => {
                const sellerId = item.product?.seller_id;
                if (sellerId) {
                  if (!sellerItems[sellerId]) {
                    sellerItems[sellerId] = [];
                  }
                  sellerItems[sellerId].push(item);
                }
              });

              // Create orders
              for (const sellerId of Object.keys(sellerItems)) {
                const items = sellerItems[sellerId];
                const total = items.reduce((sum, item) => 
                  sum + (item.product?.price || 0) * item.quantity, 0
                );

                await axios.post(
                  `${BACKEND_URL}/api/orders`,
                  {
                    seller_id: sellerId,
                    items: items.map(i => ({
                      product_id: i.product_id,
                      quantity: i.quantity,
                      price_at_time: i.product?.price || 0,
                    })),
                    total_amount: total,
                    delivery_method: deliveryMethod,
                  },
                  { headers: { Authorization: `Bearer ${sessionToken}` } }
                );
              }

              // Clear cart
              for (const item of cart.items) {
                await axios.delete(`${BACKEND_URL}/api/cart/remove/${item.product_id}`, {
                  headers: { Authorization: `Bearer ${sessionToken}` },
                });
              }

              Alert.alert(
                'Order Placed!',
                'Your order has been placed successfully. The seller will contact you shortly.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/home'),
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error placing order:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to place order');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const subtotal = calculateSubtotal();
  const deliveryFee = deliveryMethod === 'delivery' ? 5.99 : 0;
  const total = subtotal + deliveryFee;
  const itemCount = cart?.items?.length || 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Checkout',
          headerBackTitle: 'Cart',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView style={styles.scrollView}>
          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryCard}>
              {cart?.items.map((item) => (
                <View key={item.product_id} style={styles.summaryItem}>
                  {item.product?.photos && item.product.photos.length > 0 ? (
                    <Image source={{ uri: item.product.photos[0] }} style={styles.itemImage} />
                  ) : (
                    <View style={[styles.itemImage, styles.imagePlaceholder]}>
                      <MaterialCommunityIcons name="image-off" size={20} color="#d1d5db" />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.product?.name}</Text>
                    <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>
                    ${((item.product?.price || 0) * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Delivery Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Method</Text>
            <View style={styles.deliveryOptions}>
              <TouchableOpacity
                style={[
                  styles.deliveryOption,
                  deliveryMethod === 'pickup' && styles.deliveryOptionSelected,
                ]}
                onPress={() => setDeliveryMethod('pickup')}
              >
                <MaterialCommunityIcons
                  name="store"
                  size={24}
                  color={deliveryMethod === 'pickup' ? '#10b981' : '#6b7280'}
                />
                <View style={styles.deliveryOptionInfo}>
                  <Text style={[
                    styles.deliveryOptionTitle,
                    deliveryMethod === 'pickup' && styles.deliveryOptionTitleSelected,
                  ]}>
                    Pickup
                  </Text>
                  <Text style={styles.deliveryOptionDesc}>Pick up from seller</Text>
                </View>
                <Text style={styles.deliveryPrice}>Free</Text>
                {deliveryMethod === 'pickup' && (
                  <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.deliveryOption,
                  deliveryMethod === 'delivery' && styles.deliveryOptionSelected,
                ]}
                onPress={() => setDeliveryMethod('delivery')}
              >
                <MaterialCommunityIcons
                  name="truck-delivery"
                  size={24}
                  color={deliveryMethod === 'delivery' ? '#10b981' : '#6b7280'}
                />
                <View style={styles.deliveryOptionInfo}>
                  <Text style={[
                    styles.deliveryOptionTitle,
                    deliveryMethod === 'delivery' && styles.deliveryOptionTitleSelected,
                  ]}>
                    Delivery
                  </Text>
                  <Text style={styles.deliveryOptionDesc}>Delivered to your address</Text>
                </View>
                <Text style={styles.deliveryPrice}>$5.99</Text>
                {deliveryMethod === 'delivery' && (
                  <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Price Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Details</Text>
            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Subtotal ({itemCount} items)</Text>
                <Text style={styles.priceValue}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery Fee</Text>
                <Text style={styles.priceValue}>
                  {deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : 'Free'}
                </Text>
              </View>
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Place Order Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.placeOrderButton, processing && styles.placeOrderButtonDisabled]}
            onPress={handlePlaceOrder}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle" size={22} color="#ffffff" />
                <Text style={styles.placeOrderText}>Place Order • ${total.toFixed(2)}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
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
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  imagePlaceholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  deliveryOptions: {
    gap: 12,
  },
  deliveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deliveryOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  deliveryOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deliveryOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  deliveryOptionTitleSelected: {
    color: '#10b981',
  },
  deliveryOptionDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  deliveryPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginRight: 12,
  },
  priceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
  footer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  placeOrderButtonDisabled: {
    opacity: 0.6,
  },
  placeOrderText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
