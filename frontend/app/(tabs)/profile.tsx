import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ProfileScreen() {
  const { user, logout, sessionToken, updateUser } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState(user?.location?.address || '');
  const [loading, setLoading] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(user?.profile_photo || '');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [zipCode, setZipCode] = useState('');
  const [savingZip, setSavingZip] = useState(false);

  useEffect(() => {
    if (sessionToken && user) {
      loadProfileData();
      loadMyProducts();
      loadTransactionHistory();
      // Auto-detect location if not already set
      if (!user?.location) {
        requestLocation();
      }
    }
  }, [sessionToken, user?.user_id]);

  const loadProfileData = async () => {
    if (!sessionToken) return;
    try {
      // Get updated user data with followers/following
      const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const userData = response.data;
      setFollowersCount(userData.followers?.length || 0);
      setFollowingCount(userData.following?.length || 0);
      setBio(userData.bio || '');
      setZipCode(userData.zip_code || userData.location?.zip_code || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadMyProducts = async () => {
    if (!sessionToken || !user?.user_id) return;
    try {
      const response = await axios.get(`${BACKEND_URL}/api/products/seller/${user.user_id}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setMyProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadTransactionHistory = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/orders/my-orders`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setTransactions(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      setLoading(true);
      const loc = await Location.getCurrentPositionAsync({});
      const [result] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const address = `${result.city}, ${result.region}`;
      setLocation(address);

      await updateProfile({
        location: {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          address,
        },
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get location');
    } finally {
      setLoading(false);
    }
  };

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Photo library access is required');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfilePhoto(base64Image);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to pick photo');
    }
  };

  const updateProfile = async (updates: any) => {
    try {
      setLoading(true);
      const response = await axios.put(
        `${BACKEND_URL}/api/users/profile`,
        updates,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      updateUser(response.data);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const updates: any = {};
    
    if (name !== user?.name) updates.name = name;
    if (profilePhoto !== user?.profile_photo) updates.profile_photo = profilePhoto;
    if (bio) updates.bio = bio;

    if (Object.keys(updates).length > 0) {
      await updateProfile(updates);
    }
    
    setEditing(false);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        onPress: () => logout(),
        style: 'destructive' 
      },
    ]);
  };

  const handleSaveZipCode = async () => {
    if (!zipCode.trim()) return;
    
    try {
      setSavingZip(true);
      const response = await axios.put(
        `${BACKEND_URL}/api/users/profile`,
        { zip_code: zipCode.trim() },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      updateUser(response.data);
      // Clear GPS location display when ZIP is saved
      setLocation('');
      Alert.alert('Success', 'ZIP code saved successfully!');
    } catch (error: any) {
      console.error('Error saving zip code:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save ZIP code');
    } finally {
      setSavingZip(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={editing ? handleSave : () => setEditing(true)}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#10b981" />
            ) : (
              <Text style={styles.editButtonText}>{editing ? 'Save' : 'Edit'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={editing ? pickProfilePhoto : undefined}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <MaterialCommunityIcons name="account" size={48} color="#9ca3af" />
              </View>
            )}
            {editing && (
              <View style={styles.editAvatarBadge}>
                <MaterialCommunityIcons name="camera" size={16} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>

          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#9ca3af"
            />
          ) : (
            <Text style={styles.userName}>{user?.name}</Text>
          )}
          
          <Text style={styles.userEmail}>{user?.email}</Text>

          {editing && (
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Add a bio..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={150}
            />
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push(`/followers/${user?.user_id}`)}
            >
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push(`/following/${user?.user_id}`)}
            >
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{myProducts.length}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="map-marker" size={24} color="#10b981" />
            <Text style={styles.sectionTitle}>Location</Text>
          </View>
          
          {/* Current Location Display */}
          <View style={styles.currentLocationBox}>
            <MaterialCommunityIcons name="map-marker-check" size={20} color="#10b981" />
            <View style={styles.currentLocationText}>
              <Text style={styles.currentLocationLabel}>Your Location</Text>
              <Text style={styles.currentLocationValue}>
                {location || 'Detecting...'}
              </Text>
            </View>
            <TouchableOpacity style={styles.changeLocationButton} onPress={requestLocation}>
              <MaterialCommunityIcons name="refresh" size={20} color="#10b981" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.locationHint}>
            Your location is used to show nearby products and sellers
          </Text>
        </View>

        {/* My Products Section */}
        {myProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="store" size={24} color="#10b981" />
              <Text style={styles.sectionTitle}>My Products ({myProducts.length})</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {myProducts.slice(0, 5).map((product) => (
                <View key={product.product_id} style={styles.productCard}>
                  {product.photos?.[0] ? (
                    <Image source={{ uri: product.photos[0] }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.productImagePlaceholder]}>
                      <MaterialCommunityIcons name="image-off" size={20} color="#d1d5db" />
                    </View>
                  )}
                  <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.productPrice}>${product.price}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Transaction History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="history" size={24} color="#10b981" />
            <Text style={styles.sectionTitle}>Recent Orders</Text>
          </View>
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((txn, index) => (
              <View key={index} style={styles.transactionCard}>
                <View style={styles.transactionIcon}>
                  <MaterialCommunityIcons
                    name="shopping"
                    size={20}
                    color="#10b981"
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>
                    {txn.items?.[0]?.product_name || 'Order'}
                  </Text>
                  <Text style={styles.transactionStatus}>
                    {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                  </Text>
                </View>
                <Text style={styles.transactionAmount}>${txn.total_amount?.toFixed(2)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No orders yet</Text>
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
  },
  editButtonText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 14,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    alignItems: 'center',
    marginBottom: 8,
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
  editAvatarBadge: {
    position: 'absolute',
    bottom: 16,
    right: 0,
    backgroundColor: '#10b981',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#10b981',
    paddingVertical: 4,
    marginBottom: 4,
    minWidth: 150,
  },
  bioInput: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
    minHeight: 60,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationTextContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 14,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
  },
  locationButton: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  productCard: {
    width: 120,
    marginRight: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 80,
  },
  productImagePlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    padding: 8,
    paddingBottom: 2,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10b981',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  transactionStatus: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  locationLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  currentLocationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  currentLocationText: {
    flex: 1,
  },
  currentLocationLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  currentLocationValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
  },
  changeLocationButton: {
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  locationHint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  locationOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  locationOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  zipCodeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  zipCodeSection: {
    marginTop: 4,
  },
  zipCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  zipCodeInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  saveZipButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  saveZipButtonDisabled: {
    opacity: 0.5,
  },
  saveZipButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  zipCodeHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
});
