import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface UserProfile {
  user_id: string;
  name: string;
  email?: string;
  profile_photo?: string;
  bio?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  rating: number;
  total_sales: number;
  joined_date: string;
  followers?: string[];
  following?: string[];
}

interface Product {
  product_id: string;
  name: string;
  price: number;
  photos: string[];
  category: string;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessionToken, user: currentUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    loadUserProfile();
    loadUserProducts();
  }, [id]);

  const loadUserProfile = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setProfile(response.data);
      setFollowersCount(response.data.followers?.length || 0);
      setFollowingCount(response.data.following?.length || 0);
      setIsFollowing(response.data.followers?.includes(currentUser?.user_id) || false);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProducts = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/products/seller/${id}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await axios.post(
          `${BACKEND_URL}/api/users/${id}/unfollow`,
          {},
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
      } else {
        await axios.post(
          `${BACKEND_URL}/api/users/${id}/follow`,
          {},
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
    }
  };

  const handleMessage = () => {
    router.push(`/chat/${id}`);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  const isOwnProfile = currentUser?.user_id === id;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: profile.name,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.container}>
        {/* Profile Header */}
        <View style={styles.header}>
          {profile.profile_photo ? (
            <Image source={{ uri: profile.profile_photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <MaterialCommunityIcons name="account" size={48} color="#9ca3af" />
            </View>
          )}

          <Text style={styles.userName}>{profile.name}</Text>

          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          {profile.location?.address && (
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#10b981" />
              <Text style={styles.locationText}>{profile.location.address}</Text>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push(`/followers/${id}`)}
            >
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push(`/following/${id}`)}
            >
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.total_sales}</Text>
              <Text style={styles.statLabel}>Sales</Text>
            </View>

            <View style={styles.statItem}>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={16} color="#fbbf24" />
                <Text style={styles.statNumber}>{profile.rating.toFixed(1)}</Text>
              </View>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followingButton]}
                onPress={handleFollow}
              >
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
                <MaterialCommunityIcons name="message-outline" size={20} color="#10b981" />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products ({products.length})</Text>

          {products.length > 0 ? (
            <View style={styles.productsGrid}>
              {products.map((product) => (
                <TouchableOpacity key={product.product_id} style={styles.productCard}>
                  {product.photos?.[0] ? (
                    <Image source={{ uri: product.photos[0] }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.productImagePlaceholder]}>
                      <MaterialCommunityIcons name="image-off" size={24} color="#d1d5db" />
                    </View>
                  )}
                  <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.noProductsText}>No products listed</Text>
          )}
        </View>
      </ScrollView>
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
  errorText: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: '#10b981',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  followButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#10b981',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  messageButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 120,
  },
  productImagePlaceholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    padding: 8,
    paddingBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  noProductsText: {
    textAlign: 'center',
    color: '#9ca3af',
    paddingVertical: 24,
  },
});
