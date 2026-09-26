import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  ScrollView, SafeAreaView, TouchableOpacity, RefreshControl,
  Modal, Dimensions, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://r.ykcloud.ru/api.php';
const { width } = Dimensions.get('window');

// Градиенты для предметов
const SUBJECT_GRADIENTS: Record<string, [string, string]> = {
  'Математика': ['#667eea', '#764ba2'],
  'Алгебра': ['#667eea', '#764ba2'],
  'Геометрия': ['#667eea', '#764ba2'],
  'Вероятность и статистика': ['#667eea', '#764ba2'],
  'Практикум по математике': ['#667eea', '#764ba2'],
  
  'Русский язык': ['#f093fb', '#f5576c'],
  'Литература': ['#f093fb', '#f5576c'],
  'Теория и практика НС': ['#f093fb', '#f5576c'],
  'Теория и практика Н сочинения': ['#f093fb', '#f5576c'],
  
  'История': ['#fa709a', '#fee140'],
  'История в лицах': ['#fa709a', '#fee140'],
  'История Классный час': ['#fa709a', '#fee140'],
  'Обществознание': ['#fa709a', '#fee140'],
  'Введение в обществознание': ['#fa709a', '#fee140'],
  'Право, экономика, этика': ['#fa709a', '#fee140'],
  
  'Физика': ['#4facfe', '#00f2fe'],
  'Химия': ['#43e97b', '#38f9d7'],
  'Биология': ['#43e97b', '#38f9d7'],
  'Естествознание': ['#43e97b', '#38f9d7'],
  'Шаг в мир медицины У': ['#43e97b', '#38f9d7'],
  'Научные основы хим Пр': ['#43e97b', '#38f9d7'],
  
  'Английский язык': ['#a18cd1', '#fbc2eb'],
  'Английский язык все': ['#a18cd1', '#fbc2eb'],
  'Деловой английский': ['#a18cd1', '#fbc2eb'],
  
  'Физическая культура': ['#ff9a9e', '#fad0c4'],
  'Физ-ра Б. сп': ['#ff9a9e', '#fad0c4'],
  'Физкультура': ['#ff9a9e', '#fad0c4'],
  
  'Информатика': ['#30cfd0', '#330867'],
  'Мир информ. технологи': ['#30cfd0', '#330867'],
  'Инжинерная графика': ['#30cfd0', '#330867'],
  
  'География': ['#a8edea', '#fed6e3'],
  'Россия в мире': ['#a8edea', '#fed6e3'],
  
  'ИЗО': ['#ffecd2', '#fcb69f'],
  'Изобразительное искусство': ['#ffecd2', '#fcb69f'],
  'Музыка': ['#ffecd2', '#fcb69f'],
  'Музыка 32': ['#ffecd2', '#fcb69f'],
  
  'Труд (технология)': ['#ff9966', '#ff5e62'],
  'Труд (технология) все': ['#ff9966', '#ff5e62'],
  'Труд технология (все)': ['#ff9966', '#ff5e62'],
  'Труд технология (все )': ['#ff9966', '#ff5e62'],
  'Труд Технология(все)': ['#ff9966', '#ff5e62'],
  'Труд Технология (все)': ['#ff9966', '#ff5e62'],
  
  'Черчение': ['#c471f5', '#fa71cd'],
  
  'Разговоры о важном': ['#ff6e7f', '#bfe9ff'],
  'Разговоры о важном  акт. зал': ['#ff6e7f', '#bfe9ff'],
  'Классный час': ['#ff6e7f', '#bfe9ff'],
  'Классный час  " Биология': ['#ff6e7f', '#bfe9ff'],
  'Классный час  "Россия - мои горизонты"': ['#ff6e7f', '#bfe9ff'],
  'Классный час  "': ['#ff6e7f', '#bfe9ff'],
  'Россия-мои горозонты': ['#ff6e7f', '#bfe9ff'],
  'Россия-мои горозонты Классный час': ['#ff6e7f', '#bfe9ff'],
  'Россия-мои горизонты': ['#ff6e7f', '#bfe9ff'],
  
  'ОБЗР': ['#84fab0', '#8fd3f4'],
  'Самоподготовка': ['#d299c2', '#fef9d7'],
  'Самоподготовка 20 а': ['#d299c2', '#fef9d7'],
  'Самоподготовка киностудия': ['#d299c2', '#fef9d7'],
  'Самоподготока': ['#d299c2', '#fef9d7'],
  
  'Индивидуальный проект': ['#89f7fe', '#66a6ff'],
  
  'ВИС': ['#fddb92', '#d1fdff'],
};

const DEFAULT_GRADIENT: [string, string] = ['#667eea', '#764ba2'];

function getGradient(subject: string): [string, string] {
  const cleanSubject = subject.trim();
  return SUBJECT_GRADIENTS[cleanSubject] || DEFAULT_GRADIENT;
}

function getGradientStyle(subject: string) {
  const [color1, color2] = getGradient(subject);
  return {
    backgroundColor: color1,
  };
}

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
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
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

  // Экран выбора класса
  if (!selectedClass) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.welcomeHeader}>
          <Text style={styles.welcomeEmoji}></Text>
          <Text style={styles.welcomeTitle}>Расписание</Text>
          <Text style={styles.welcomeSubtitle}>Выберите ваш класс</Text>
        </View>
        <ScrollView style={styles.welcomeBody}>
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Шапка с градиентом */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Расписание</Text>
            <Text style={styles.headerSubtitle}>
              {selectedSubject ? `📚 ${selectedSubject}` : `🏫 ${selectedClass}`}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.changeClassButton}
            onPress={() => setShowClassPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.changeClassIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Навигация по датам */}
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

      {/* Фильтр по предмету */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowSubjectPicker(true)}
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

      {/* Список уроков */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={fetchSchedule}
            tintColor="#667eea"
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
              <Text style={styles.retryText}>Повторить</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
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
            {schedule.map((lesson, index) => {
              const [color1, color2] = getGradient(lesson.subject);
              return (
                <View 
                  key={lesson.id || index} 
                  style={[
                    styles.lessonCard,
                    {
                      backgroundColor: color1,
                    }
                  ]}
                >
                  {/* Градиентный оверлей */}
                  <View style={[
                    styles.lessonCardGradient,
                    {
                      backgroundColor: color2,
                      opacity: 0.3,
                    }
                  ]} />
                  
                  {/* Номер урока */}
                  <View style={styles.lessonNumberContainer}>
                    <Text style={styles.lessonNumberText}>{lesson.lesson_number}</Text>
                  </View>

                  {/* Контент урока */}
                  <View style={styles.lessonContent}>
                    <View style={styles.lessonTop}>
                      <Text style={styles.lessonTime}>
                        {lesson.time_start} — {lesson.time_end}
                      </Text>
                      {selectedSubject && (
                        <Text style={styles.lessonClass}>{lesson.class_name}</Text>
                      )}
                    </View>
                    
                    <Text style={styles.lessonSubject} numberOfLines={2}>
                      {lesson.subject}
                    </Text>
                    
                    <View style={styles.lessonDetails}>
                      {lesson.room && (
                        <View style={styles.detailBadge}>
                          <Text style={styles.detailIcon}>🚪</Text>
                          <Text style={styles.detailText}>Каб. {lesson.room}</Text>
                        </View>
                      )}
                      {lesson.group_number && (
                        <View style={styles.detailBadge}>
                          <Text style={styles.detailIcon}></Text>
                          <Text style={styles.detailText}>Гр. {lesson.group_number}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
            
            <View style={styles.bottomSpacing} />
          </View>
        )}
      </ScrollView>

      {/* Модалка выбора класса */}
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
                      selectedClass === cls && styles.modalGridItemSelected,
                    ]}
                    onPress={() => saveClass(cls)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modalGridText,
                      selectedClass === cls && styles.modalGridTextSelected,
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

      {/* Модалка выбора предмета */}
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
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[
                  styles.subjectOption,
                  !selectedSubject && styles.subjectOptionSelected,
                ]}
                onPress={() => {
                  setSelectedSubject('');
                  setShowSubjectPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.subjectOptionText,
                  !selectedSubject && styles.subjectOptionTextSelected,
                ]}>
                  📚 Все предметы
                </Text>
              </TouchableOpacity>
              {subjects.filter(s => s).map((subj) => (
                <TouchableOpacity
                  key={subj}
                  style={[
                    styles.subjectOption,
                    selectedSubject === subj && styles.subjectOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedSubject(subj);
                    setShowSubjectPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.subjectOptionText,
                    selectedSubject === subj && styles.subjectOptionTextSelected,
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

      {/* Модалка выбора даты */}
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
                    selectedDate === date && styles.dateOptionSelected,
                  ]}
                  onPress={() => selectDate(date)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateOptionDay}>{getDayOfWeek(date)}</Text>
                  <Text style={[
                    styles.dateOptionText,
                    selectedDate === date && styles.dateOptionTextSelected,
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
    backgroundColor: '#0f0f1e',
  },
  
  // ===== ЭКРАН ПРИВЕТСТВИЯ =====
  welcomeHeader: {
    backgroundColor: '#667eea',
    paddingTop: 80,
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
    backgroundColor: '#667eea',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  classGridText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // ===== ШАПКА =====
  header: {
    backgroundColor: '#667eea',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeClassIcon: {
    fontSize: 22,
  },
  
  // ===== НАВИГАЦИЯ ПО ДАТАМ =====
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateNavIcon: {
    fontSize: 28,
    color: '#FFFFFF',
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
    color: '#a0a0b0',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // ===== ФИЛЬТР =====
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  filterIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  filterText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearFilter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearFilterText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  
  // ===== КОНТЕНТ =====
  scrollContainer: {
    padding: 16,
  },
  lessonsList: {
    gap: 16,
  },
  bottomSpacing: {
    height: 20,
  },
  
  // ===== КАРТОЧКА УРОКА С ГРАДИЕНТОМ =====
  lessonCard: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    minHeight: 140,
    justifyContent: 'center',
  },
  lessonCardGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  lessonNumberContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  lessonNumberText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lessonContent: {
    flex: 1,
    paddingRight: 60,
  },
  lessonTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lessonTime: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  lessonClass: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lessonSubject: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  lessonDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // ===== ЗАГРУЗКА =====
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 16,
    color: '#a0a0b0',
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
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#667eea',
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
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#a0a0b0',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // ===== МОДАЛЬНЫЕ ОКНА =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3a3a5e',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
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
    backgroundColor: '#2a2a4e',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalGridItemSelected: {
    backgroundColor: '#667eea',
  },
  modalGridText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalGridTextSelected: {
    color: '#FFFFFF',
  },
  modalCloseButton: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#2a2a4e',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  
  // ===== ОПЦИИ ПРЕДМЕТА =====
  subjectOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    marginBottom: 8,
  },
  subjectOptionSelected: {
    backgroundColor: '#667eea',
  },
  subjectOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
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
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    marginBottom: 8,
  },
  dateOptionSelected: {
    backgroundColor: '#667eea',
  },
  dateOptionDay: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a0a0b0',
    textTransform: 'uppercase',
    width: 50,
    letterSpacing: 1,
  },
  dateOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  dateOptionTextSelected: {
    color: '#FFFFFF',
  },
});