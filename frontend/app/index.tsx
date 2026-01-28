import React, { useState, useEffect, useRef } from 'react';
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

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Color palette - Modern minimalist with pleasant colors
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
  recording: '#ff4757',
};

interface Todo {
  id: string;
  text: string;
  priority: 'urgent' | 'normal' | 'low';
  completed: boolean;
  created_at: string;
}

// Web Speech API types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<'urgent' | 'normal' | 'low'>('normal');
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [speechSupported, setSpeechSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API for web platform
  useEffect(() => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'ro-RO';
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          setInputText(transcript);
        };
        
        recognition.onend = () => {
          setIsRecording(false);
        };
        
        recognition.onerror = (event: any) => {
          console.log('Speech recognition error:', event.error);
          setIsRecording(false);
          if (event.error === 'not-allowed') {
            Alert.alert(
              'Permisiune necesară',
              'Te rugăm să permiți accesul la microfon din setările browser-ului.'
            );
          }
        };
        
        recognitionRef.current = recognition;
      }
    } else {
      // For native platforms, we'll use expo-speech-recognition
      setSpeechSupported(true);
    }
  }, []);

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

  // Voice recognition function
  const handleVoiceButton = async () => {
    if (Platform.OS === 'web') {
      // Web platform - use Web Speech API
      if (!recognitionRef.current) {
        Alert.alert(
          'Funcție indisponibilă',
          'Browser-ul tău nu suportă recunoașterea vocală. Încearcă Chrome sau Edge.'
        );
        return;
      }
      
      if (isRecording) {
        recognitionRef.current.stop();
        setIsRecording(false);
      } else {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (error) {
          console.log('Error starting recognition:', error);
          Alert.alert('Eroare', 'Nu s-a putut porni recunoașterea vocală.');
        }
      }
    } else {
      // Native platform - use expo-speech-recognition
      try {
        const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');
        
        if (isRecording) {
          ExpoSpeechRecognitionModule.stop();
          setIsRecording(false);
        } else {
          const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          
          if (!result.granted) {
            Alert.alert(
              'Permisiune necesară',
              'Te rugăm să permiți accesul la microfon pentru a folosi comanda vocală.'
            );
            return;
          }

          ExpoSpeechRecognitionModule.start({
            lang: 'ro-RO',
            interimResults: true,
            maxAlternatives: 1,
            continuous: false,
          });
          setIsRecording(true);
        }
      } catch (error) {
        console.log('Native speech recognition error:', error);
        Alert.alert('Eroare', 'Recunoașterea vocală nu este disponibilă pe acest dispozitiv.');
      }
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
              activeOpacity={0.7}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={24}
                color={isRecording ? COLORS.white : COLORS.primary}
              />
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
              placeholder={isRecording ? 'Ascult...' : 'Adaugă un task nou...'}
              placeholderTextColor={isRecording ? COLORS.recording : COLORS.textSecondary}
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
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={28} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Voice recording indicator */}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Înregistrez... Vorbește acum!</Text>
            </View>
          )}
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
    backgroundColor: COLORS.recording,
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
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.recording,
    marginRight: 8,
  },
  recordingText: {
    color: COLORS.recording,
    fontSize: 14,
    fontWeight: '500',
  },
});
