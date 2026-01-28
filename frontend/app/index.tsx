import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Color palette
const COLORS = {
  background: '#1a1a2e',
  cardBackground: '#16213e',
  primary: '#e94560',
  secondary: '#0f3460',
  accent: '#533483',
  text: '#eaeaea',
  textSecondary: '#a0a0a0',
  urgent: '#ff6b6b',
  normal: '#4ecdc4',
  low: '#95afc0',
  completed: '#6c757d',
  white: '#ffffff',
};

interface Todo {
  id: string;
  text: string;
  priority: 'urgent' | 'normal' | 'low';
  completed: boolean;
  created_at: string;
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<'urgent' | 'normal' | 'low'>('normal');
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Fetch todos on mount
  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await fetch(`${API_URL}/api/todos`);
      if (response.ok) {
        const data = await response.json();
        setTodos(data);
      }
    } catch (error) {
      console.log('Error fetching todos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTodo = async () => {
    if (!inputText.trim()) return;
    
    try {
      const response = await fetch(`${API_URL}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          priority: selectedPriority,
        }),
      });
      
      if (response.ok) {
        const newTodo = await response.json();
        setTodos([newTodo, ...todos]);
        setInputText('');
        Keyboard.dismiss();
      }
    } catch (error) {
      console.log('Error adding todo:', error);
      Alert.alert('Eroare', 'Nu s-a putut adăuga task-ul');
    }
  };

  const toggleTodo = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/todos/${id}/toggle`, {
        method: 'PUT',
      });
      
      if (response.ok) {
        const updatedTodo = await response.json();
        setTodos(todos.map(t => t.id === id ? updatedTodo : t));
      }
    } catch (error) {
      console.log('Error toggling todo:', error);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/todos/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setTodos(todos.filter(t => t.id !== id));
      }
    } catch (error) {
      console.log('Error deleting todo:', error);
    }
  };

  const confirmDelete = (id: string, text: string) => {
    Alert.alert(
      'Șterge Task',
      `Sigur vrei să ștergi "${text}"?`,
      [
        { text: 'Anulează', style: 'cancel' },
        { text: 'Șterge', style: 'destructive', onPress: () => deleteTodo(id) },
      ]
    );
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permisiune necesară', 'Te rugăm să permiți accesul la microfon pentru a folosi comanda vocală.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.log('Error starting recording:', error);
      Alert.alert('Eroare', 'Nu s-a putut porni înregistrarea');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      
      // For demo purposes, we'll show a prompt for the user to type
      // In production, you would send the audio to a speech-to-text API
      Alert.alert(
        'Înregistrare completă',
        'Scrie textul task-ului pe care l-ai dictat:',
        [
          {
            text: 'OK',
            onPress: () => {
              // Focus on input field
            }
          }
        ]
      );
      
      setRecording(null);
    } catch (error) {
      console.log('Error stopping recording:', error);
    }
  };

  const handleVoiceButton = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return COLORS.urgent;
      case 'normal': return COLORS.normal;
      case 'low': return COLORS.low;
      default: return COLORS.normal;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgent';
      case 'normal': return 'Normal';
      case 'low': return 'Scăzut';
      default: return 'Normal';
    }
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const renderTodoItem = ({ item }: { item: Todo }) => (
    <View style={[
      styles.todoItem,
      item.completed && styles.todoItemCompleted
    ]}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => toggleTodo(item.id)}
      >
        <View style={[
          styles.checkboxInner,
          item.completed && styles.checkboxChecked,
          { borderColor: getPriorityColor(item.priority) }
        ]}>
          {item.completed && (
            <Ionicons name="checkmark" size={16} color={COLORS.white} />
          )}
        </View>
      </TouchableOpacity>
      
      <View style={styles.todoContent}>
        <Text style={[
          styles.todoText,
          item.completed && styles.todoTextCompleted
        ]}>
          {item.text}
        </Text>
        <View style={styles.priorityBadge}>
          <View style={[
            styles.priorityDot,
            { backgroundColor: getPriorityColor(item.priority) }
          ]} />
          <Text style={styles.priorityText}>
            {getPriorityLabel(item.priority)}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => confirmDelete(item.id, item.text)}
      >
        <Ionicons name="trash-outline" size={22} color={COLORS.urgent} />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Se încarcă...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Lista de Task-uri</Text>
          <Text style={styles.headerSubtitle}>
            {todos.filter(t => !t.completed).length} task-uri rămase
          </Text>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {(['all', 'active', 'completed'] as const).map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterTab,
                filter === filterOption && styles.filterTabActive
              ]}
              onPress={() => setFilter(filterOption)}
            >
              <Text style={[
                styles.filterText,
                filter === filterOption && styles.filterTextActive
              ]}>
                {filterOption === 'all' ? 'Toate' : 
                 filterOption === 'active' ? 'Active' : 'Complete'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Todo List */}
        <FlatList
          data={filteredTodos}
          renderItem={renderTodoItem}
          keyExtractor={(item) => item.id}
          style={styles.todoList}
          contentContainerStyle={styles.todoListContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="clipboard-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {filter === 'completed' ? 'Niciun task completat' :
                 filter === 'active' ? 'Niciun task activ' :
                 'Adaugă primul tău task!'}
              </Text>
            </View>
          }
        />

        {/* Input Section */}
        <View style={styles.inputSection}>
          {/* Priority Selector */}
          <View style={styles.prioritySelector}>
            {(['urgent', 'normal', 'low'] as const).map((priority) => (
              <TouchableOpacity
                key={priority}
                style={[
                  styles.priorityButton,
                  selectedPriority === priority && {
                    backgroundColor: getPriorityColor(priority),
                  }
                ]}
                onPress={() => setSelectedPriority(priority)}
              >
                <Text style={[
                  styles.priorityButtonText,
                  selectedPriority === priority && styles.priorityButtonTextActive
                ]}>
                  {getPriorityLabel(priority)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Input Row */}
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[
                styles.voiceButton,
                isRecording && styles.voiceButtonRecording
              ]}
              onPress={handleVoiceButton}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={24}
                color={isRecording ? COLORS.white : COLORS.primary}
              />
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
              placeholder="Adaugă un task nou..."
              placeholderTextColor={COLORS.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={addTodo}
              returnKeyType="done"
            />
            
            <TouchableOpacity
              style={[
                styles.addButton,
                !inputText.trim() && styles.addButtonDisabled
              ]}
              onPress={addTodo}
              disabled={!inputText.trim()}
            >
              <Ionicons name="add" size={28} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.text,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.white,
  },
  todoList: {
    flex: 1,
  },
  todoListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  todoItemCompleted: {
    opacity: 0.7,
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.completed,
    borderColor: COLORS.completed,
  },
  todoContent: {
    flex: 1,
  },
  todoText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 4,
  },
  todoTextCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  priorityText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  inputSection: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  prioritySelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 10,
  },
  priorityButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
  },
  priorityButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  priorityButtonTextActive: {
    color: COLORS.white,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonRecording: {
    backgroundColor: COLORS.urgent,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    paddingHorizontal: 20,
    color: COLORS.text,
    fontSize: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: COLORS.secondary,
    opacity: 0.5,
  },
});
