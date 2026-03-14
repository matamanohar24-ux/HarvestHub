import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Index() {
  const { isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="sprout" size={64} color="#10b981" />
        </View>
        <Text style={styles.appName}>HarvestHub</Text>
        <Text style={styles.tagline}>
          Buy, sell & exchange home-grown{'\n'}crops with your community
        </Text>
      </View>

      {/* Features */}
      <View style={styles.featuresSection}>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons name="map-marker-radius" size={20} color="#10b981" />
          <Text style={styles.featureText}>Discover fresh produce nearby</Text>
        </View>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons name="store" size={20} color="#10b981" />
          <Text style={styles.featureText}>Sell your backyard harvest</Text>
        </View>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons name="account-group" size={20} color="#10b981" />
          <Text style={styles.featureText}>Join your local grower community</Text>
        </View>
      </View>

      {/* Sign In Section */}
      <View style={styles.authSection}>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={() => login()}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="google" size={22} color="#ffffff" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink}>Terms</Text> and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  heroSection: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    gap: 16,
    paddingHorizontal: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  authSection: {
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    gap: 12,
  },
  googleButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  termsLink: {
    color: '#2563eb',
  },
});
