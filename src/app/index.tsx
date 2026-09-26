import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  ScrollView, SafeAreaView, TouchableOpacity, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://r.ykcloud.ru/api.php';

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
  const [subjectSearch, setSubjectSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const scrollViewRef = useRef<ScrollView>(null);
  const lessonRefs = useRef<Map<number, View>>(new Map());
  const hasScrolledToCurrent = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadSavedClass();
    fetchClasses();
    fetchSubjects();
    fetchDates();
  }, []);

  useEffect(() => {
    if (selectedClass || selectedSubject) {
      fetchSchedule();
      hasScrolledToCurrent.current = false;
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
      if (data.ok) setSubjects(data.items);
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
          if (a.lesson_number !== b.lesson_number) return a.lesson_number - b.lesson_number;
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

  const parseTimeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const getLessonStatus = (lesson: Lesson): 'past' | 'current' | 'future' => {
    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const startMinutes = parseTimeToMinutes(lesson.time_start);
    const endMinutes = parseTimeToMinutes(lesson.time_end);
    if (nowMinutes >= endMinutes) return 'past';
    if (nowMinutes >= startMinutes && nowMinutes < endMinutes) return 'current';
    return 'future';
  };

  useEffect(() => {
    if (schedule.length === 0) return;
    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    let currentIndex = -1;
    schedule.forEach((lesson, index) => {
      const startMinutes = parseTimeToMinutes(lesson.time_start);
      const endMinutes = parseTimeToMinutes(lesson.time_end);
      if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
        currentIndex = index;
      }
    });
    if (currentIndex >= 0 && !hasScrolledToCurrent.current && scrollViewRef.current) {
      setTimeout(() => {
        const ref = lessonRefs.current.get(currentIndex);
        if (ref) {
          ref.measureInWindow((x, y, w, h) => {
            scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
          });
        }
      }, 300);
      hasScrolledToCurrent.current = true;
    }
  }, [schedule, currentTime]);

  const filteredSubjects = subjects.filter(s =>
    s.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  const pastLessons = schedule.filter(l => getLessonStatus(l) === 'past').length;
  const currentLessons = schedule.filter(l => getLessonStatus(l) === 'current').length;
  const futureLessons = schedule.filter(l => getLessonStatus(l) === 'future').length;

  if (!selectedClass) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeIcon}>
            <Text style={styles.welcomeIconText}>📚</Text>
          </View>
          <Text style={styles.welcomeTitle}>Расписание</Text>
          <Text style={styles.welcomeSubtitle}>Выберите ваш класс</Text>
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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Расписание</Text>
            <Text style={styles.headerSubtitle}>
              {selectedSubject ? `📚 ${selectedSubject}` : `🏫 ${selectedClass}`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowClassPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerButtonText}>Выбор класса</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateNav}>
          <TouchableOpacity style={styles.dateNavButton} onPress={() => addDays(-1)} activeOpacity={0.7}>
            <Text style={styles.dateNavIcon}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateDisplay} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
            <Text style={styles.dateDay}>{getDayOfWeek(selectedDate)}</Text>
            <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateNavButton} onPress={() => addDays(1)} activeOpacity={0.7}>
            <Text style={styles.dateNavIcon}>›</Text>
          </TouchableOpacity>
        </View>

        {schedule.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{pastLessons}</Text>
              <Text style={styles.statLabel}>пройдено</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.statNumberCurrent]}>{currentLessons}</Text>
              <Text style={styles.statLabel}>сейчас</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{futureLessons}</Text>
              <Text style={styles.statLabel}>впереди</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.subjectFilterContainer}>
        <TouchableOpacity
          style={styles.subjectFilterButton}
          onPress={() => { setSubjectSearch(''); setShowSubjectPicker(true); }}
          activeOpacity={0.7}
        >
          <Text style={styles.subjectFilterIcon}></Text>
          <Text style={styles.subjectFilterText}>{selectedSubject || 'Все предметы'}</Text>
          {selectedSubject && (
            <TouchableOpacity
              style={styles.clearSubject}
              onPress={(e) => { e.stopPropagation(); setSelectedSubject(''); }}
            >
              <Text style={styles.clearSubjectText}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.timelineContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSchedule} tintColor="#6366F1" />}
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>😕</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchSchedule} activeOpacity={0.7}>
              <Text style={styles.retryText}>Повторить</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
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
          <View style={styles.timeline}>
            <View style={styles.timelineLine} />
            {schedule.map((lesson, index) => {
              const status = getLessonStatus(lesson);
              const isCurrent = status === 'current';
              const isPast = status === 'past';
              return (
                <View
                  key={lesson.id || index}
                  ref={(ref) => { if (ref) lessonRefs.current.set(index, ref); }}
                  style={[styles.timelineItem, isCurrent && styles.timelineItemCurrent]}
                >
                  <View style={[
                    styles.timelineDot,
                    isCurrent && styles.timelineDotCurrent,
                    isPast && styles.timelineDotPast,
                  ]}>
                    {isCurrent && <View style={styles.timelineDotPulse} />}
                    <Text style={[styles.timelineDotText, isPast && styles.timelineDotTextPast]}>
                      {lesson.lesson_number}
                    </Text>
                  </View>
                  <View style={[styles.lessonCard, isCurrent && styles.lessonCardCurrent, isPast && styles.lessonCardPast]}>
                    <View style={styles.lessonHeader}>
                      <View style={styles.lessonTimeBlock}>
                        <Text style={[styles.lessonTime, isCurrent && styles.lessonTimeCurrent, isPast && styles.lessonTimePast]}>
                          {lesson.time_start}
                        </Text>
                        <Text style={[styles.lessonTimeEnd, isPast && styles.lessonTimePast]}>
                          {lesson.time_end}
                        </Text>
                      </View>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <View style={styles.currentBadgeDot} />
                          <Text style={styles.currentBadgeText}>Сейчас</Text>
                        </View>
                      )}
                      {isPast && <Text style={styles.pastBadge}>Пройден</Text>}
                    </View>
                    {selectedSubject && (
                      <Text style={[styles.lessonClass, isPast && styles.lessonClassPast]}>
                        {lesson.class_name}
                      </Text>
                    )}
                    <Text style={[styles.lessonSubject, isPast && styles.lessonSubjectPast]} numberOfLines={2}>
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
                          <Text style={styles.detailIcon}>👥</Text>
                          <Text style={styles.detailText}>Гр. {lesson.group_number}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={styles.timelineEnd} />
          </View>
        )}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Modal visible={showClassPicker} animationType="slide" transparent={true} onRequestClose={() => setShowClassPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Выберите класс</Text>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.modalGrid}>
                {classes.map((cls) => (
                  <TouchableOpacity key={cls} style={[styles.modalGridItem, selectedClass === cls && styles.modalGridItemSelected]} onPress={() => saveClass(cls)} activeOpacity={0.7}>
                    <Text style={[styles.modalGridText, selectedClass === cls && styles.modalGridTextSelected]}>{cls}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowClassPicker(false)} activeOpacity={0.7}>
              <Text style={styles.modalCloseText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ИСПРАВЛЕННАЯ МОДАЛКА С ПОИСКОМ */}
      <Modal visible={showSubjectPicker} animationType="slide" transparent={true} onRequestClose={() => setShowSubjectPicker(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentSubject}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Выберите предмет</Text>
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Поиск предмета..."
                  value={subjectSearch}
                  onChangeText={setSubjectSearch}
                  placeholderTextColor="#CBD5E1"
                  autoCapitalize="none"
                  autoFocus
                />
                {subjectSearch ? (
                  <TouchableOpacity onPress={() => setSubjectSearch('')}>
                    <Text style={styles.searchClear}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <ScrollView
                style={styles.modalScrollSubject}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                <TouchableOpacity
                  style={[styles.subjectListItem, !selectedSubject && styles.subjectListItemSelected]}
                  onPress={() => { setSelectedSubject(''); setShowSubjectPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subjectListItemText, !selectedSubject && styles.subjectListItemTextSelected]}>
                    📚 Все предметы
                  </Text>
                  {!selectedSubject && <Text style={styles.subjectListCheck}>✓</Text>}
                </TouchableOpacity>
                {filteredSubjects.map((subj) => (
                  <TouchableOpacity
                    key={subj}
                    style={[styles.subjectListItem, selectedSubject === subj && styles.subjectListItemSelected]}
                    onPress={() => { setSelectedSubject(subj); setShowSubjectPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.subjectListItemText, selectedSubject === subj && styles.subjectListItemTextSelected]}>
                      {subj}
                    </Text>
                    {selectedSubject === subj && <Text style={styles.subjectListCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
                {filteredSubjects.length === 0 && (
                  <View style={styles.noResults}>
                    <Text style={styles.noResultsText}>Ничего не найдено</Text>
                  </View>
                )}
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
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showDatePicker} animationType="slide" transparent={true} onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Выберите дату</Text>
            <ScrollView style={styles.modalScroll}>
              {dates.map((date) => (
                <TouchableOpacity key={date} style={[styles.dateOption, selectedDate === date && styles.dateOptionSelected]} onPress={() => selectDate(date)} activeOpacity={0.7}>
                  <Text style={styles.dateOptionDay}>{getDayOfWeek(date)}</Text>
                  <Text style={[styles.dateOptionText, selectedDate === date && styles.dateOptionTextSelected]}>{formatDate(date)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
              <Text style={styles.modalCloseText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  welcomeContainer: { flex: 1, padding: 24, alignItems: 'center' },
  welcomeIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginTop: 40, marginBottom: 20, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  welcomeIconText: { fontSize: 40 },
  welcomeTitle: { fontSize: 28, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  welcomeSubtitle: { fontSize: 16, color: '#64748B', marginBottom: 32 },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  classGridItem: { width: '22%', aspectRatio: 1, backgroundColor: '#FFFFFF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  classGridText: { fontSize: 18, fontWeight: '700', color: '#6366F1' },
  header: { backgroundColor: '#FFFFFF', paddingTop: 16, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  headerSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  headerButton: { backgroundColor: '#6366F1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  headerButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  dateNav: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 4 },
  dateNavButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  dateNavIcon: { fontSize: 24, color: '#6366F1', fontWeight: '300', marginTop: -4 },
  dateDisplay: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  dateDay: { fontSize: 11, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  dateText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingVertical: 8 },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  statNumberCurrent: { color: '#6366F1' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },
  subjectFilterContainer: { padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  subjectFilterButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  subjectFilterIcon: { fontSize: 20, marginRight: 10 },
  subjectFilterText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1E293B' },
  clearSubject: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  clearSubjectText: { fontSize: 14, color: '#64748B', fontWeight: 'bold' },
  timelineContainer: { paddingVertical: 16 },
  timeline: { position: 'relative', paddingHorizontal: 16 },
  timelineLine: { position: 'absolute', left: 38, top: 24, bottom: 24, width: 2, backgroundColor: '#E2E8F0' },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  timelineItemCurrent: {},
  timelineDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#6366F1', justifyContent: 'center', alignItems: 'center', zIndex: 2, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  timelineDotCurrent: { backgroundColor: '#6366F1', borderColor: '#6366F1', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 5 },
  timelineDotPast: { borderColor: '#9CA3AF', backgroundColor: '#9CA3AF' },
  timelineDotPulse: { position: 'absolute', width: '100%', height: '100%', borderRadius: 20, backgroundColor: '#6366F1', opacity: 0.4 },
  timelineDotText: { fontSize: 14, fontWeight: '800', color: '#6366F1' },
  timelineDotTextPast: { color: '#FFFFFF' },
  timelineEnd: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E2E8F0', marginLeft: 33, marginTop: 8 },
  lessonCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginLeft: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#6366F1' },
  lessonCardCurrent: { backgroundColor: '#EEF2FF', borderLeftColor: '#6366F1', shadowColor: '#6366F1', shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  lessonCardPast: { opacity: 0.6, borderLeftColor: '#9CA3AF' },
  lessonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lessonTimeBlock: { flexDirection: 'row', alignItems: 'baseline' },
  lessonTime: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginRight: 4 },
  lessonTimeCurrent: { color: '#6366F1' },
  lessonTimePast: { color: '#9CA3AF' },
  lessonTimeEnd: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  currentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366F1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  currentBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginRight: 6 },
  currentBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  pastBadge: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  lessonClass: { fontSize: 11, fontWeight: '700', color: '#6366F1', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  lessonClassPast: { color: '#9CA3AF' },
  lessonSubject: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 10, lineHeight: 22 },
  lessonSubjectPast: { color: '#9CA3AF' },
  lessonDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  detailIcon: { fontSize: 12, marginRight: 4 },
  detailText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { marginTop: 16, color: '#64748B', fontSize: 15, fontWeight: '500' },
  errorContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  errorEmoji: { fontSize: 64, marginBottom: 16 },
  errorText: { color: '#64748B', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 72, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  bottomSpacing: { height: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 32, maxHeight: '85%' },
  modalContentSubject: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 32, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
  modalScroll: { maxHeight: 500, paddingHorizontal: 20 },
  modalScrollSubject: { maxHeight: 400, paddingHorizontal: 20 },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  modalGridItem: { width: '22%', aspectRatio: 1.2, backgroundColor: '#F8FAFC', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalGridItemSelected: { backgroundColor: '#6366F1' },
  modalGridText: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  modalGridTextSelected: { color: '#FFFFFF' },
  modalCloseButton: { marginHorizontal: 20, marginTop: 20, backgroundColor: '#F8FAFC', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalCloseText: { fontSize: 15, fontWeight: '700', color: '#6366F1' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#1E293B' },
  searchClear: { fontSize: 18, color: '#64748B', padding: 4 },
  subjectListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 8 },
  subjectListItemSelected: { backgroundColor: '#6366F1' },
  subjectListItemText: { fontSize: 15, fontWeight: '600', color: '#1E293B', flex: 1 },
  subjectListItemTextSelected: { color: '#FFFFFF' },
  subjectListCheck: { fontSize: 20, color: '#6366F1', fontWeight: '600', marginLeft: 8 },
  noResults: { paddingVertical: 20, alignItems: 'center' },
  noResultsText: { fontSize: 15, color: '#64748B' },
  dateOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 8 },
  dateOptionSelected: { backgroundColor: '#6366F1' },
  dateOptionDay: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', width: 50, letterSpacing: 1 },
  dateOptionText: { fontSize: 14, fontWeight: '600', color: '#1E293B', flex: 1 },
  dateOptionTextSelected: { color: '#FFFFFF' },
});