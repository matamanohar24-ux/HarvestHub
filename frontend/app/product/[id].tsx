import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

interface Review {
  review_id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  user_photo?: string;
  rating: number;
  comment?: string;
  created_at: string;
}

interface Product {
  product_id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  quantity: number;
  unit: string;
  photos: string[];
  status: string;
  distance?: number;
  seller_id: string;
  average_rating?: number;
  review_count?: number;
  seller?: {
    user_id: string;
    name: string;
    email?: string;
    phone?: string;
    profile_photo?: string;
    rating: number;
    total_sales: number;
    location?: { address?: string };
  };
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessionToken, user } = useAuth();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    loadProduct();
    loadReviews();
  }, [id]);

  const loadProduct = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/products/${id}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setProduct(response.data);
    } catch (error) {
      console.error('Error loading product:', error);
      Alert.alert('Error', 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/products/${id}/reviews`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setReviews(response.data);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  const handleSubmitReview = async () => {
    if (!newRating) return;
    
    try {
      setSubmittingReview(true);
      await axios.post(
        `${BACKEND_URL}/api/products/${id}/reviews`,
        { rating: newRating, comment: newComment.trim() || null },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      Alert.alert('Success', 'Review submitted!');
      setShowReviewModal(false);
      setNewRating(5);
      setNewComment('');
      loadReviews();
      loadProduct(); // Reload to get updated rating
    } catch (error: any) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAddToCart = async () => {
    try {
      setAddingToCart(true);
      await axios.post(
        `${BACKEND_URL}/api/cart/add`,
        {
          product_id: product?.product_id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      Alert.alert(
        'Added to Cart!',
        `${product?.name} has been added to your cart.`,
        [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') }
        ]
      );
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleChatWithSeller = () => {
    if (product?.seller?.user_id || product?.seller_id) {
      router.push(`/chat/${product.seller?.user_id || product.seller_id}`);
    }
  };

  const handleViewSellerProfile = () => {
    if (product?.seller?.user_id || product?.seller_id) {
      router.push(`/user/${product.seller?.user_id || product.seller_id}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="package-variant-remove" size={64} color="#d1d5db" />
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwnProduct = user?.user_id === product.seller_id;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: product.name,
          headerBackTitle: 'Back',
        }}
      />
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {/* Image Gallery */}
          <View style={styles.imageContainer}>
            {product.photos && product.photos.length > 0 ? (
              <>
                <Image
                  source={{ uri: product.photos[selectedImageIndex] }}
                  style={styles.mainImage}
                />
                {product.photos.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.thumbnailScroll}
                  >
                    {product.photos.map((photo, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setSelectedImageIndex(index)}
                      >
                        <Image
                          source={{ uri: photo }}
                          style={[
                            styles.thumbnail,
                            selectedImageIndex === index && styles.thumbnailActive,
                          ]}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            ) : (
              <View style={[styles.mainImage, styles.imagePlaceholder]}>
                <MaterialCommunityIcons name="image-off" size={64} color="#d1d5db" />
              </View>
            )}
          </View>

          {/* Product Info */}
          <View style={styles.infoSection}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>
            
            <Text style={styles.productName}>{product.name}</Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.price}>${product.price.toFixed(2)}</Text>
              <Text style={styles.unit}>/ {product.unit}</Text>
            </View>

            {product.distance !== undefined && (
              <View style={styles.distanceRow}>
                <MaterialCommunityIcons name="map-marker" size={16} color="#10b981" />
                <Text style={styles.distanceText}>{product.distance.toFixed(1)} miles away</Text>
              </View>
            )}

            <View style={styles.availabilityRow}>
              <MaterialCommunityIcons name="package-variant" size={16} color="#6b7280" />
              <Text style={styles.availabilityText}>
                {product.quantity} {product.unit} available
              </Text>
            </View>

            {product.description && (
              <View style={styles.descriptionSection}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.descriptionText}>{product.description}</Text>
              </View>
            )}
          </View>

          {/* Seller Card */}
          <View style={styles.sellerSection}>
            <Text style={styles.sectionTitle}>Seller</Text>
            <TouchableOpacity style={styles.sellerCard} onPress={handleViewSellerProfile}>
              {product.seller?.profile_photo ? (
                <Image source={{ uri: product.seller.profile_photo }} style={styles.sellerAvatar} />
              ) : (
                <View style={[styles.sellerAvatar, styles.avatarPlaceholder]}>
                  <MaterialCommunityIcons name="account" size={28} color="#9ca3af" />
                </View>
              )}

              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{product.seller?.name}</Text>
                <View style={styles.sellerStats}>
                  <View style={styles.ratingRow}>
                    <MaterialCommunityIcons name="star" size={14} color="#fbbf24" />
                    <Text style={styles.ratingText}>
                      {product.seller?.rating?.toFixed(1) || '5.0'}
                    </Text>
                  </View>
                  <Text style={styles.salesText}>
                    {product.seller?.total_sales || 0} sales
                  </Text>
                </View>
                {product.seller?.location?.address && (
                  <Text style={styles.sellerLocation}>{product.seller.location.address}</Text>
                )}
              </View>

              <MaterialCommunityIcons name="chevron-right" size={24} color="#9ca3af" />
            </TouchableOpacity>

            {!isOwnProduct && (
              <TouchableOpacity style={styles.chatButton} onPress={handleChatWithSeller}>
                <MaterialCommunityIcons name="message-outline" size={20} color="#10b981" />
                <Text style={styles.chatButtonText}>Chat with Seller</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Reviews Section */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <View>
                <Text style={styles.sectionTitle}>Reviews</Text>
                <View style={styles.ratingOverview}>
                  <MaterialCommunityIcons name="star" size={20} color="#fbbf24" />
                  <Text style={styles.overallRating}>
                    {product.average_rating?.toFixed(1) || '0.0'}
                  </Text>
                  <Text style={styles.reviewCount}>({product.review_count || 0} reviews)</Text>
                </View>
              </View>
              {!isOwnProduct && (
                <TouchableOpacity
                  style={styles.writeReviewButton}
                  onPress={() => setShowReviewModal(true)}
                >
                  <MaterialCommunityIcons name="pencil" size={18} color="#10b981" />
                  <Text style={styles.writeReviewText}>Write Review</Text>
                </TouchableOpacity>
              )}
            </View>

            {reviews.length === 0 ? (
              <Text style={styles.noReviewsText}>No reviews yet. Be the first to review!</Text>
            ) : (
              reviews.slice(0, 3).map((review) => (
                <TouchableOpacity
                  key={review.review_id}
                  style={styles.reviewItem}
                  onPress={() => router.push(`/user/${review.user_id}`)}
                >
                  {review.user_photo ? (
                    <Image source={{ uri: review.user_photo }} style={styles.reviewerAvatar} />
                  ) : (
                    <View style={[styles.reviewerAvatar, styles.avatarPlaceholder]}>
                      <MaterialCommunityIcons name="account" size={16} color="#9ca3af" />
                    </View>
                  )}
                  <View style={styles.reviewContent}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewerName}>{review.user_name}</Text>
                      <View style={styles.reviewRating}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <MaterialCommunityIcons
                            key={star}
                            name={star <= review.rating ? 'star' : 'star-outline'}
                            size={14}
                            color="#fbbf24"
                          />
                        ))}
                      </View>
                    </View>
                    {review.comment && (
                      <Text style={styles.reviewComment}>{review.comment}</Text>
                    )}
                    <Text style={styles.reviewTime}>
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        {/* Bottom Action Bar */}
        {!isOwnProduct && (
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={handleAddToCart}
              disabled={addingToCart}
            >
              {addingToCart ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="cart-plus" size={22} color="#ffffff" />
                  <Text style={styles.addToCartText}>Add to Cart</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Review Modal */}
        <Modal
          visible={showReviewModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowReviewModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <TouchableOpacity
                style={[styles.submitReviewButton, submittingReview && { opacity: 0.5 }]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitReviewText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.ratingSelector}>
              <Text style={styles.ratingLabel}>Your Rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setNewRating(star)}>
                    <MaterialCommunityIcons
                      name={star <= newRating ? 'star' : 'star-outline'}
                      size={40}
                      color="#fbbf24"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.commentInput}>
              <Text style={styles.ratingLabel}>Your Review (optional)</Text>
              <TextInput
                style={styles.commentTextInput}
                placeholder="Share your experience with this product..."
                placeholderTextColor="#9ca3af"
                value={newComment}
                onChangeText={setNewComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </SafeAreaView>
        </Modal>
      </View>
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
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#10b981',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    backgroundColor: '#ffffff',
  },
  mainImage: {
    width: width,
    height: width * 0.8,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailScroll: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: '#10b981',
  },
  infoSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10b981',
  },
  unit: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 4,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  distanceText: {
    fontSize: 14,
    color: '#10b981',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availabilityText: {
    fontSize: 14,
    color: '#6b7280',
  },
  descriptionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  sellerSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 8,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
  },
  sellerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  sellerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  salesText: {
    fontSize: 13,
    color: '#6b7280',
  },
  sellerLocation: {
    fontSize: 12,
    color: '#9ca3af',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  addToCartText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  // Reviews section styles
  reviewsSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 80,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  ratingOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  overallRating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  reviewCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  writeReviewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  noReviewsText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  reviewItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  reviewContent: {
    flex: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 4,
  },
  reviewTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    fontWeight: '600',
    color: '#1f2937',
  },
  cancelText: {
    fontSize: 16,
    color: '#6b7280',
  },
  submitReviewButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  submitReviewText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  ratingSelector: {
    padding: 24,
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  commentInput: {
    paddingHorizontal: 24,
  },
  commentTextInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1f2937',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
});
