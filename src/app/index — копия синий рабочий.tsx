import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  ScrollView, SafeAreaView, TouchableOpacity, RefreshControl,
  Modal, TextInput, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://r.ykcloud.ru/api.php';
const { width } = Dimensions.get('window');

// Новая цветовая схема — бирюзово-зелёная
const COLORS = {
  primary: '#0077B6',        // Морской синий
  primaryDark: '#005F8A',    // Тёмно-синий
  primaryLight: '#48CAE4',   // Голубой
  accent: '#FFB703',         // Жёлтый акцент
  background: '#F0F8FF',     // Очень светлый голубой
  card: '#FFFFFF',
  text: '#1B263B',
  textSecondary: '#415A77',
  textLight: '#778DA9',
  border: '#D0E1F0',
  success: '#2A9D8F',
  error: '#E63946',
  white: '#FFFFFF',
};

interface Lesson {
  id: number;
  schedule_date: string;
  class_name: string;
  lesson_number: number;
  time_start: string;
  time_end: string;
  subject: string;
  teacher: string | null;
  room: string | null;
  group_number: string | null;
}

export default function App() {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [schedule, setSchedule] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadSavedClass();
    fetchClasses();
    fetchSubjects();
    fetchDates();
  }, []);

  useEffect(() => {
    if (selectedClass || selectedSubject) {
      fetchSchedule();
    }
  }, [selectedClass, selectedDate, selectedSubject]);

  const loadSavedClass = async () => {
    try {
      const saved = await AsyncStorage.getItem('selectedClass');
      if (saved) setSelectedClass(saved);
    } catch (e) {}
  };

  const saveClass = async (cls: string) => {
    try {
      await AsyncStorage.setItem('selectedClass', cls);
      setSelectedClass(cls);
      setShowClassPicker(false);
    } catch (e) {}
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch(`${API_URL}?action=classes`);
      const data = await res.json();
      if (data.ok) setClasses(data.items);
    } catch (e) {}
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API_URL}?action=subjects`);
      const data = await res.json();
      if (data.ok) setSubjects(['', ...data.items]);
    } catch (e) {}
  };

  const fetchDates = async () => {
    try {
      const res = await fetch(`${API_URL}?action=dates`);
      const data = await res.json();
      if (data.ok) setDates(data.items);
    } catch (e) {}
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = `${API_URL}?action=schedule&date=${selectedDate}`;
      
      if (selectedSubject) {
        url += `&subject=${encodeURIComponent(selectedSubject)}`;
      } else if (selectedClass) {
        url += `&class=${encodeURIComponent(selectedClass)}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.ok) {
        const sorted = data.items.sort((a: Lesson, b: Lesson) => {
          if (a.lesson_number !== b.lesson_number) {
            return a.lesson_number - b.lesson_number;
          }
          return a.class_name.localeCompare(b.class_name);
        });
        setSchedule(sorted);
      } else {
        setError(data.error || 'Ошибка загрузки');
      }
    } catch (e) {
      setError('Не удалось загрузить расписание');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    if (date.toDateString() === tomorrow.toDateString()) return 'Завтра';
    
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric', 
      month: 'long',
      weekday: 'long'
    };
    return date.toLocaleDateString('ru-RU', options);
  };

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setShowDatePicker(false);
  };

  const addDays = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  // Фильтрация предметов по поиску
  const filteredSubjects = subjects.filter(s => 
    s.toLowerCase().includes(searchText.toLowerCase())
  );

  // Экран выбора класса
  if (!selectedClass) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeHeader}>
          <Text style={styles.welcomeEmoji}>🎓</Text>
          <Text style={styles.welcomeTitle}>Выберите класс</Text>
          <Text style={styles.welcomeSubtitle}>
            Для просмотра расписания занятий
          </Text>
        </View>

        <View style={styles.welcomeBody}>
          <View style={styles.classGrid}>
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls}
                style={styles.classGridItem}
                onPress={() => saveClass(cls)}
                activeOpacity={0.7}
              >
                <Text style={styles.classGridText}>{cls}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Расписание</Text>
            <Text style={styles.headerSubtitle}>
              {selectedSubject ? `📚 ${selectedSubject}` : `🏫 ${selectedClass}`}
            </Text>
          </View>
          {/* Кнопка смены класса — крупная и заметная */}
          <TouchableOpacity 
            style={styles.changeClassButton}
            onPress={() => setShowClassPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.changeClassIcon}>🔄</Text>
            <Text style={styles.changeClassText}>Сменить класс</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Панель навигации по датам */}
      <View style={styles.dateNav}>
        <TouchableOpacity 
          style={styles.dateNavButton}
          onPress={() => addDays(-1)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateNavIcon}>‹</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.dateDisplay}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateDay}>{getDayOfWeek(selectedDate)}</Text>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.dateNavButton}
          onPress={() => addDays(1)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateNavIcon}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Кнопка фильтра по предмету */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => {
            setSearchText('');
            setShowSubjectPicker(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.filterIcon}>📖</Text>
          <Text style={styles.filterText}>
            {selectedSubject || 'Все предметы'}
          </Text>
          {selectedSubject && (
            <TouchableOpacity 
              style={styles.clearFilter}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedSubject('');
              }}
            >
              <Text style={styles.clearFilterText}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* Контент */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={fetchSchedule}
            tintColor={COLORS.primary}
          />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>😕</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={fetchSchedule}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>Попробовать снова</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Загрузка расписания...</Text>
          </View>
        ) : schedule.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>Нет уроков</Text>
            <Text style={styles.emptyText}>
              {selectedSubject 
                ? `По предмету "${selectedSubject}" уроков не найдено`
                : 'На этот день расписание ещё не добавлено'}
            </Text>
          </View>
        ) : (
          <View style={styles.lessonsList}>
            {schedule.map((lesson, index) => (
              <View key={lesson.id || index} style={styles.lessonCard}>
                {/* Номер урока и время */}
                <View style={styles.lessonHeader}>
                  <View style={styles.lessonNumberBadge}>
                    <Text style={styles.lessonNumberText}>{lesson.lesson_number}</Text>
                  </View>
                  <View style={styles.lessonTimeContainer}>
                    <Text style={styles.lessonTime}>
                      {lesson.time_start} — {lesson.time_end}
                    </Text>
                  </View>
                </View>

                {/* Информация об уроке */}
                <View style={styles.lessonBody}>
                  {selectedSubject && (
                    <View style={styles.classBadge}>
                      <Text style={styles.classBadgeText}>{lesson.class_name}</Text>
                    </View>
                  )}
                  <Text style={styles.lessonSubject}>{lesson.subject}</Text>
                  
                  <View style={styles.lessonDetails}>
                    {lesson.room && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>🚪</Text>
                        <Text style={styles.detailText}>Каб. {lesson.room}</Text>
                      </View>
                    )}
                    {lesson.group_number && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>👥</Text>
                        <Text style={styles.detailText}>Группа {lesson.group_number}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
            
            <View style={styles.bottomSpacing} />
          </View>
        )}
      </ScrollView>

      {/* Модальное окно выбора класса */}
      <Modal 
        visible={showClassPicker} 
        animationType="slide" 
        transparent={true}
        onRequestClose={() => setShowClassPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Выберите класс</Text>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.modalGrid}>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls}
                    style={[
                      styles.modalGridItem,
                      selectedClass === cls && styles.modalGridItemSelected
                    ]}
                    onPress={() => saveClass(cls)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modalGridText,
                      selectedClass === cls && styles.modalGridTextSelected
                    ]}>
                      {cls}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowClassPicker(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно выбора предмета с поиском */}
      <Modal 
        visible={showSubjectPicker} 
        animationType="slide" 
        transparent={true}
        onRequestClose={() => setShowSubjectPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Выберите предмет</Text>
            
            {/* Поиск */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}></Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Поиск предмета..."
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={COLORS.textLight}
              />
              {searchText ? (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Text style={styles.searchClear}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Все предметы */}
              <TouchableOpacity
                style={[
                  styles.subjectOption,
                  !selectedSubject && styles.subjectOptionSelected
                ]}
                onPress={() => {
                  setSelectedSubject('');
                  setShowSubjectPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.subjectOptionText,
                  !selectedSubject && styles.subjectOptionTextSelected
                ]}>
                  📚 Все предметы
                </Text>
              </TouchableOpacity>

              {filteredSubjects.filter(s => s).map((subj) => (
                <TouchableOpacity
                  key={subj}
                  style={[
                    styles.subjectOption,
                    selectedSubject === subj && styles.subjectOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedSubject(subj);
                    setShowSubjectPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.subjectOptionText,
                    selectedSubject === subj && styles.subjectOptionTextSelected
                  ]}>
                    {subj}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowSubjectPicker(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно выбора даты */}
      <Modal 
        visible={showDatePicker} 
        animationType="slide" 
        transparent={true}
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Выберите дату</Text>
            <ScrollView style={styles.modalScroll}>
              {dates.map((date) => (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.dateOption,
                    selectedDate === date && styles.dateOptionSelected
                  ]}
                  onPress={() => selectDate(date)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateOptionDay}>{getDayOfWeek(date)}</Text>
                  <Text style={[
                    styles.dateOptionText,
                    selectedDate === date && styles.dateOptionTextSelected
                  ]}>
                    {formatDate(date)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowDatePicker(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  
  // ===== ЭКРАН ПРИВЕТСТВИЯ =====
  welcomeHeader: {
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  welcomeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  welcomeBody: {
    flex: 1,
    padding: 24,
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  classGridItem: {
    width: (width - 72) / 4,
    aspectRatio: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  classGridText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  
  // ===== ШАПКА =====
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  changeClassButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  changeClassIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  changeClassText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  
  // ===== НАВИГАЦИЯ ПО ДАТАМ =====
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateNavIcon: {
    fontSize: 28,
    color: COLORS.primary,
    fontWeight: '300',
    marginTop: -4,
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateDay: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  
  // ===== ФИЛЬТР ПО ПРЕДМЕТАМ =====
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  filterIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  filterText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  clearFilter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearFilterText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  
  // ===== КОНТЕНТ =====
  scrollContainer: {
    padding: 16,
  },
  lessonsList: {
    gap: 12,
  },
  bottomSpacing: {
    height: 20,
  },
  
  // ===== КАРТОЧКА УРОКА =====
  lessonCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  lessonNumberBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lessonNumberText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lessonTimeContainer: {
    flex: 1,
  },
  lessonTime: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  lessonBody: {
    padding: 16,
    paddingTop: 12,
  },
  classBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  classBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  lessonSubject: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    lineHeight: 24,
  },
  lessonDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  
  // ===== ЗАГРУЗКА =====
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  
  // ===== ОШИБКА =====
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  
  // ===== ПУСТОЕ СОСТОЯНИЕ =====
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // ===== МОДАЛЬНЫЕ ОКНА =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  modalScroll: {
    maxHeight: 500,
    paddingHorizontal: 20,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  modalGridItem: {
    width: (width - 64) / 4,
    aspectRatio: 1.2,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalGridItemSelected: {
    backgroundColor: COLORS.primary,
  },
  modalGridText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalGridTextSelected: {
    color: '#FFFFFF',
  },
  modalCloseButton: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: COLORS.background,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  
  // ===== ПОИСК В МОДАЛКЕ =====
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
  },
  searchClear: {
    fontSize: 18,
    color: COLORS.textSecondary,
    padding: 4,
  },
  
  // ===== ОПЦИИ ПРЕДМЕТА =====
  subjectOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginBottom: 8,
  },
  subjectOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  subjectOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  subjectOptionTextSelected: {
    color: '#FFFFFF',
  },
  
  // ===== ОПЦИИ ДАТЫ =====
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginBottom: 8,
  },
  dateOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  dateOptionDay: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    width: 50,
    letterSpacing: 1,
  },
  dateOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  dateOptionTextSelected: {
    color: '#FFFFFF',
  },
});