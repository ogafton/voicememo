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
  Keyboard,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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
  recording: '#ff4757',
  modalBackground: 'rgba(0,0,0,0.7)',
};

interface TodoList {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

interface Todo {
  id: string;
  list_id: string;
  text: string;
  priority: 'urgent' | 'normal' | 'low';
  completed: boolean;
  created_at: string;
}

export default function TodoApp() {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [selectedList, setSelectedList] = useState<TodoList | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<'urgent' | 'normal' | 'low'>('normal');
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showListModal, setShowListModal] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition for Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = 'ro-RO';
          recognition.onresult = (event: any) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            setInputText(transcript);
          };
          recognition.onend = () => setIsRecording(false);
          recognition.onerror = () => setIsRecording(false);
          recognitionRef.current = recognition;
        }
      } catch (error) {
        console.log('Speech init error:', error);
      }
    }
  }, []);

  // Fetch lists and todos on mount
  useEffect(() => {
    fetchLists();
  }, []);

  // Fetch todos when selected list changes
  useEffect(() => {
    if (selectedList) {
      fetchTodos(selectedList.id);
    }
  }, [selectedList]);

  const fetchLists = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lists`);
      if (response.ok) {
        const data = await response.json();
        setLists(data);
        // Select default list or first list
        const defaultList = data.find((l: TodoList) => l.is_default) || data[0];
        if (defaultList) {
          setSelectedList(defaultList);
        }
      }
    } catch (error) {
      console.log('Error fetching lists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTodos = async (listId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/todos?list_id=${listId}`);
      if (response.ok) {
        const data = await response.json();
        setTodos(data);
      }
    } catch (error) {
      console.log('Error fetching todos:', error);
    }
  };

  const createList = async () => {
    if (!newListName.trim()) return;
    
    try {
      const response = await fetch(`${API_URL}/api/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      
      if (response.ok) {
        const newList = await response.json();
        setLists([...lists, newList]);
        setSelectedList(newList);
        setNewListName('');
        setShowNewListModal(false);
      }
    } catch (error) {
      console.log('Error creating list:', error);
    }
  };

  const setDefaultList = async (listId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });
      
      if (response.ok) {
        // Update local state
        setLists(lists.map(l => ({
          ...l,
          is_default: l.id === listId
        })));
      }
    } catch (error) {
      console.log('Error setting default list:', error);
    }
  };

  const clearList = async () => {
    if (!selectedList) return;
    
    try {
      const response = await fetch(`${API_URL}/api/lists/${selectedList.id}/clear`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setTodos([]);
        setShowOptionsModal(false);
      }
    } catch (error) {
      console.log('Error clearing list:', error);
    }
  };

  const deleteList = async (listId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/lists/${listId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const newLists = lists.filter(l => l.id !== listId);
        setLists(newLists);
        if (selectedList?.id === listId) {
          setSelectedList(newLists[0] || null);
        }
        setShowListModal(false);
      }
    } catch (error) {
      console.log('Error deleting list:', error);
    }
  };

  const addTodo = async () => {
    if (!inputText.trim() || !selectedList) return;
    
    try {
      const response = await fetch(`${API_URL}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          priority: selectedPriority,
          list_id: selectedList.id,
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

  const handleVoiceButton = () => {
    if (Platform.OS === 'web' && recognitionRef.current) {
      if (isRecording) {
        recognitionRef.current.stop();
        setIsRecording(false);
      } else {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (error) {
          setIsRecording(false);
        }
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
    <View style={[styles.todoItem, item.completed && styles.todoItemCompleted]}>
      <TouchableOpacity style={styles.checkbox} onPress={() => toggleTodo(item.id)}>
        <View style={[
          styles.checkboxInner,
          item.completed && styles.checkboxChecked,
          { borderColor: getPriorityColor(item.priority) }
        ]}>
          {item.completed && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
        </View>
      </TouchableOpacity>
      
      <View style={styles.todoContent}>
        <Text style={[styles.todoText, item.completed && styles.todoTextCompleted]}>
          {item.text}
        </Text>
        <View style={styles.priorityBadge}>
          <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
          <Text style={styles.priorityText}>{getPriorityLabel(item.priority)}</Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.deleteButton} onPress={() => deleteTodo(item.id)}>
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
        {/* Header with List Selector */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.listSelector} onPress={() => setShowListModal(true)}>
            <Text style={styles.headerTitle}>{selectedList?.name || 'Selectează listă'}</Text>
            <Ionicons name="chevron-down" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={() => setShowOptionsModal(true)}>
              <Ionicons name="ellipsis-vertical" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.headerSubtitle}>
          {todos.filter(t => !t.completed).length} task-uri rămase
        </Text>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {(['all', 'active', 'completed'] as const).map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              style={[styles.filterTab, filter === filterOption && styles.filterTabActive]}
              onPress={() => setFilter(filterOption)}
            >
              <Text style={[styles.filterText, filter === filterOption && styles.filterTextActive]}>
                {filterOption === 'all' ? 'Toate' : filterOption === 'active' ? 'Active' : 'Complete'}
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
          <View style={styles.prioritySelector}>
            {(['urgent', 'normal', 'low'] as const).map((priority) => (
              <TouchableOpacity
                key={priority}
                style={[
                  styles.priorityButton,
                  selectedPriority === priority && { backgroundColor: getPriorityColor(priority) }
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

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.voiceButton, isRecording && styles.voiceButtonRecording]}
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
              placeholder={isRecording ? 'Ascult...' : 'Adaugă un task nou...'}
              placeholderTextColor={isRecording ? COLORS.recording : COLORS.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={addTodo}
              returnKeyType="done"
            />
            
            <TouchableOpacity
              style={[styles.addButton, !inputText.trim() && styles.addButtonDisabled]}
              onPress={addTodo}
              disabled={!inputText.trim()}
            >
              <Ionicons name="add" size={28} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Înregistrez... Vorbește acum!</Text>
            </View>
          )}
        </View>

        {/* List Selection Modal */}
        <Modal visible={showListModal} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowListModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Listele tale</Text>
              
              <ScrollView style={styles.listScrollView}>
                {lists.map((list) => (
                  <View key={list.id} style={styles.listItemRow}>
                    <TouchableOpacity
                      style={[
                        styles.listItem,
                        selectedList?.id === list.id && styles.listItemSelected
                      ]}
                      onPress={() => {
                        setSelectedList(list);
                        setShowListModal(false);
                      }}
                    >
                      <View style={styles.listItemContent}>
                        <Text style={styles.listItemText}>{list.name}</Text>
                        {list.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    
                    {!list.is_default && (
                      <TouchableOpacity
                        style={styles.setDefaultButton}
                        onPress={() => setDefaultList(list.id)}
                      >
                        <Ionicons name="star-outline" size={20} color={COLORS.normal} />
                      </TouchableOpacity>
                    )}
                    
                    {lists.length > 1 && !list.is_default && (
                      <TouchableOpacity
                        style={styles.deleteListButton}
                        onPress={() => deleteList(list.id)}
                      >
                        <Ionicons name="close" size={20} color={COLORS.urgent} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
              
              <TouchableOpacity
                style={styles.newListButton}
                onPress={() => {
                  setShowListModal(false);
                  setShowNewListModal(true);
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                <Text style={styles.newListButtonText}>Listă nouă</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* New List Modal */}
        <Modal visible={showNewListModal} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowNewListModal(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Listă nouă</Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="Numele listei..."
                placeholderTextColor={COLORS.textSecondary}
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setNewListName('');
                    setShowNewListModal(false);
                  }}
                >
                  <Text style={styles.modalCancelText}>Anulează</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalConfirmButton, !newListName.trim() && styles.modalButtonDisabled]}
                  onPress={createList}
                  disabled={!newListName.trim()}
                >
                  <Text style={styles.modalConfirmText}>Creează</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Options Modal */}
        <Modal visible={showOptionsModal} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowOptionsModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Opțiuni listă</Text>
              
              <TouchableOpacity style={styles.optionItem} onPress={clearList}>
                <Ionicons name="trash-outline" size={24} color={COLORS.urgent} />
                <Text style={styles.optionText}>Golește lista</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.optionItem} 
                onPress={() => {
                  setShowOptionsModal(false);
                  setShowNewListModal(true);
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color={COLORS.normal} />
                <Text style={styles.optionText}>Creează listă nouă</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.optionItem} 
                onPress={() => {
                  setShowOptionsModal(false);
                  setShowListModal(true);
                }}
              >
                <Ionicons name="list-outline" size={24} color={COLORS.text} />
                <Text style={styles.optionText}>Schimbă lista</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  listSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginRight: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.modalBackground,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  listScrollView: {
    maxHeight: 300,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItem: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
  },
  listItemSelected: {
    backgroundColor: COLORS.primary,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  defaultBadge: {
    backgroundColor: COLORS.normal,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  setDefaultButton: {
    padding: 12,
    marginLeft: 4,
  },
  deleteListButton: {
    padding: 12,
  },
  newListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
  },
  newListButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    marginBottom: 10,
  },
  optionText: {
    color: COLORS.text,
    fontSize: 16,
    marginLeft: 12,
  },
});
