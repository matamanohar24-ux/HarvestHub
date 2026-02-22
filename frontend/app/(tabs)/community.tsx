import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Comment {
  user_id: string;
  text: string;
  created_at: string;
  user_name?: string;
  user_photo?: string;
  user?: {
    name: string;
    profile_photo?: string;
  };
}

interface Post {
  post_id: string;
  user_id: string;
  content: string;
  images: string[];
  likes: string[];
  comments: Comment[];
  hashtags: string[];
  created_at: string;
  user?: {
    user_id: string;
    name: string;
    profile_photo?: string;
    location?: { lat: number; lng: number; address?: string };
  };
  distance?: number;
}

export default function CommunityScreen() {
  const { sessionToken, user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [createPostModalVisible, setCreatePostModalVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/posts?limit=50`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setPosts(response.data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
  }, []);

  const handleLike = async (postId: string) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/posts/${postId}/like`,
        {},
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      setPosts(posts.map(post => {
        if (post.post_id === postId) {
          if (response.data.liked) {
            return { ...post, likes: [...post.likes, user?.user_id || ''] };
          } else {
            return { ...post, likes: post.likes.filter(id => id !== user?.user_id) };
          }
        }
        return post;
      }));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleComment = async () => {
    if (!newComment.trim() || !selectedPost) return;

    try {
      setSubmittingComment(true);
      await axios.post(
        `${BACKEND_URL}/api/posts/${selectedPost.post_id}/comment`,
        { text: newComment.trim() },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      // Refresh posts to get updated comments
      loadPosts();
      setNewComment('');
      setCommentModalVisible(false);
      setSelectedPost(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;

    try {
      setSubmittingPost(true);
      await axios.post(
        `${BACKEND_URL}/api/posts`,
        { content: newPostContent.trim(), images: [], hashtags: [] },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      setNewPostContent('');
      setCreatePostModalVisible(false);
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleShare = async (post: Post) => {
    try {
      await Share.share({
        message: `Check out this post from ${post.user?.name} on HarvestHub:\n\n"${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}"`,
        title: 'Share Post',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleViewProfile = (userId: string) => {
    router.push(`/user/${userId}`);
  };

  const handleMessageUser = (userId: string) => {
    router.push(`/chat/${userId}`);
  };

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = item.likes?.includes(user?.user_id || '');

    return (
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.postUserInfo}
            onPress={() => handleViewProfile(item.user?.user_id || item.user_id)}
          >
            {item.user?.profile_photo ? (
              <Image source={{ uri: item.user.profile_photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <MaterialCommunityIcons name="account" size={24} color="#9ca3af" />
              </View>
            )}
            <View>
              <Text style={styles.userName}>{item.user?.name || 'Unknown'}</Text>
              <View style={styles.postMeta}>
                {item.distance !== undefined && (
                  <Text style={styles.distance}>{item.distance.toFixed(1)} mi</Text>
                )}
                <Text style={styles.timeText}>
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => handleMessageUser(item.user?.user_id || item.user_id)}
          >
            <MaterialCommunityIcons name="message-outline" size={20} color="#10b981" />
          </TouchableOpacity>
        </View>

        {/* Post Content */}
        <Text style={styles.postContent}>{item.content}</Text>

        {/* Post Images */}
        {item.images && item.images.length > 0 && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: item.images[0] }} style={styles.postImage} />
          </View>
        )}

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.post_id)}
          >
            <MaterialCommunityIcons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={isLiked ? '#ef4444' : '#6b7280'}
            />
            <Text style={[styles.actionText, isLiked && { color: '#ef4444' }]}>
              {item.likes?.length || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setSelectedPost(item);
              setCommentModalVisible(true);
            }}
          >
            <MaterialCommunityIcons name="comment-outline" size={22} color="#6b7280" />
            <Text style={styles.actionText}>{item.comments?.length || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShare(item)}
          >
            <MaterialCommunityIcons name="share-outline" size={22} color="#6b7280" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Comments Preview */}
        {item.comments && item.comments.length > 0 && (
          <TouchableOpacity
            style={styles.commentsPreview}
            onPress={() => {
              setSelectedPost(item);
              setCommentModalVisible(true);
            }}
          >
            <Text style={styles.viewCommentsText}>
              View all {item.comments.length} comments
            </Text>
          </TouchableOpacity>
        )}
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <TouchableOpacity
          style={styles.createPostButton}
          onPress={() => setCreatePostModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#10b981" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.post_id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#10b981']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="post-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share something!</Text>
          </View>
        }
        contentContainerStyle={posts.length === 0 ? { flex: 1 } : undefined}
      />

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments</Text>
            <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={selectedPost?.comments || []}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.commentItem}
                onPress={() => {
                  setCommentModalVisible(false);
                  handleViewProfile(item.user_id);
                }}
              >
                {item.user_photo ? (
                  <Image source={{ uri: item.user_photo }} style={styles.commentAvatar} />
                ) : (
                  <View style={[styles.commentAvatar, styles.avatarPlaceholder]}>
                    <MaterialCommunityIcons name="account" size={16} color="#9ca3af" />
                  </View>
                )}
                <View style={styles.commentContent}>
                  <Text style={styles.commentUser}>{item.user_name || item.user?.name || 'Anonymous'}</Text>
                  <Text style={styles.commentText}>{item.text}</Text>
                  {item.created_at && (
                    <Text style={styles.commentTime}>
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.noCommentsText}>No comments yet</Text>
            }
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.commentInputContainer}
          >
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
              placeholderTextColor="#9ca3af"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
              onPress={handleComment}
              disabled={!newComment.trim() || submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <MaterialCommunityIcons name="send" size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Create Post Modal */}
      <Modal
        visible={createPostModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreatePostModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreatePostModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Post</Text>
            <TouchableOpacity
              style={[styles.postButton, !newPostContent.trim() && styles.postButtonDisabled]}
              onPress={handleCreatePost}
              disabled={!newPostContent.trim() || submittingPost}
            >
              {submittingPost ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.createPostInput}
            placeholder="What's on your mind?"
            placeholderTextColor="#9ca3af"
            value={newPostContent}
            onChangeText={setNewPostContent}
            multiline
            autoFocus
          />
        </SafeAreaView>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  createPostButton: {
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
  },
  postCard: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  postUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  distance: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  messageButton: {
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
  },
  postContent: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f3f4f6',
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  commentsPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  viewCommentsText: {
    color: '#6b7280',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
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
  postButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  commentItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  noCommentsText: {
    textAlign: 'center',
    color: '#9ca3af',
    paddingVertical: 32,
    fontSize: 14,
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'flex-end',
    gap: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#1f2937',
  },
  sendButton: {
    backgroundColor: '#10b981',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  createPostInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#1f2937',
    textAlignVertical: 'top',
  },
});
