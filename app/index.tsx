import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator,
  ScrollView, SafeAreaView, TouchableOpacity, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  Animated, PanResponder, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://r.ykcloud.ru/api.php';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const REQUEST_TIMEOUT = 8000;

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

const CLASS_CARD_COLORS = [
  { bg: '#E0F2FE', border: '#0EA5E9', text: '#0C4A6E' },
  { bg: '#CFFAFE', border: '#06B6D4', text: '#164E63' },
  { bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A8A' },
  { bg: '#EDE9FE', border: '#8B5CF6', text: '#4C1D95' },
];

async function fetchWithTimeout(url: string, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

function SwipeableModal({ visible, onClose, children }: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true })
            .start(() => { translateY.setValue(0); onClose(); });
        } else {
          Animated.spring(translateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <TouchableOpacity style={modalStyles.overlayTouchable} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[modalStyles.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          <View style={modalStyles.dragHandle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function SubjectModal({ visible, onClose, children }: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true })
            .start(() => { translateY.setValue(0); onClose(); });
        } else {
          Animated.spring(translateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingContainer} keyboardVerticalOffset={0}>
        <View style={modalStyles.overlay}>
          <TouchableOpacity style={modalStyles.overlayTouchable} activeOpacity={1} onPress={onClose} />
          <Animated.View style={[modalStyles.sheet, { transform: [{ translateY }] }]}>
            <View {...panResponder.panHandlers} style={modalStyles.headerArea}>
              <View style={modalStyles.dragHandle} />
              <Text style={modalStyles.modalTitle}>Выберите предмет</Text>
            </View>
            <View style={modalStyles.contentArea}>{children}</View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  overlayTouchable: { ...StyleSheet.absoluteFillObject },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', elevation: 10 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#BAE6FD', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  headerArea: { paddingTop: 12, paddingBottom: 8 },
  contentArea: { paddingBottom: 32 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0C4A6E', textAlign: 'center', marginBottom: 8 },
});

export default function App() {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [schedule, setSchedule] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [showClassPickerScreen, setShowClassPickerScreen] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [announcement, setAnnouncement] = useState<string>('');
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  const scrollViewRef = useRef<ScrollView>(null);
  const lessonRefs = useRef<Map<number, View>>(new Map());
  const hasScrolledToCurrent = useRef(false);

  const announcementHeight = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cardAnims = useRef<Map<string, { scale: Animated.Value; opacity: Animated.Value }>>(new Map()).current;

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (classes.length > 0 && !classesLoading) {
      classes.forEach((cls, i) => {
        if (!cardAnims.has(cls)) {
          cardAnims.set(cls, {
            scale: new Animated.Value(0.6),
            opacity: new Animated.Value(0),
          });
        }
        const anim = cardAnims.get(cls)!;
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 300,
            delay: i * 60,
            useNativeDriver: true,
          }),
          Animated.spring(anim.scale, {
            toValue: 1,
            friction: 7,
            tension: 40,
            delay: i * 60,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [classes, classesLoading]);

  useEffect(() => {
    const run = async () => {
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])).start();

      await new Promise(r => setTimeout(r, 400));
      Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      await new Promise(r => setTimeout(r, 200));
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();

      try { await loadSavedClass(); } catch (e) {}
      await fetchClasses();
      setClassesLoading(false);
      setSubjectsLoading(true);
      try { await Promise.all([fetchSubjects(), fetchDates(), fetchAnnouncement()]); } catch (e) {}
      setSubjectsLoading(false);

      Animated.timing(progressWidth, { toValue: 1, duration: 600, useNativeDriver: false }).start();

      await new Promise(r => setTimeout(r, 700));
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(subtitleOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      await new Promise(r => setTimeout(r, 300));
      setInitialLoading(false);
    };
    run();
  }, []);

  useEffect(() => {
    if (announcement && announcementVisible) {
      Animated.spring(announcementHeight, { toValue: 1, friction: 8, tension: 40, useNativeDriver: false }).start();
    } else {
      Animated.timing(announcementHeight, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    }
  }, [announcement, announcementVisible]);

  useEffect(() => {
    if (selectedClass || selectedSubject) {
      fetchSchedule();
      hasScrolledToCurrent.current = false;
    }
  }, [selectedClass, selectedDate, selectedSubject]);

  const loadSavedClass = async () => {
    try {
      const s = await AsyncStorage.getItem('selectedClass');
      if (s) setSelectedClass(s);
    } catch (e) {}
  };

  const saveClass = async (cls: string) => {
    try {
      await AsyncStorage.setItem('selectedClass', cls);
      setSelectedClass(cls);
      setShowClassPickerScreen(false);
    } catch (e) {}
  };

  const resetClass = async () => {
    try {
      await AsyncStorage.removeItem('selectedClass');
      setSelectedClass('');
      setShowClassPickerScreen(true);
    } catch (e) {}
  };

  const fetchClasses = async () => {
    setClassesError(null);
    try {
      const r = await fetchWithTimeout(`${API_URL}?action=classes`);
      const d = await r.json();
      if (d.ok && Array.isArray(d.items)) {
        setClasses(d.items);
      } else {
        setClasses([]);
        setClassesError(d.error || 'Не удалось загрузить список классов');
      }
    } catch (e: any) {
      setClasses([]);
      const msg = e.name === 'AbortError'
        ? 'Превышено время ожидания. Отключите VPN.'
        : 'Нет соединения. Отключите VPN и проверьте интернет.';
      setClassesError(msg);
    }
  };

  const fetchSubjects = async () => {
    setSubjectsError(null);
    try {
      const r = await fetchWithTimeout(`${API_URL}?action=subjects`);
      const d = await r.json();
      if (d.ok && Array.isArray(d.items)) {
        setSubjects(d.items);
      } else {
        setSubjects([]);
        setSubjectsError(d.error || 'Не удалось загрузить предметы');
      }
    } catch (e: any) {
      setSubjects([]);
      const msg = e.name === 'AbortError'
        ? 'Превышено время ожидания загрузки предметов'
        : 'Нет соединения. Отключите VPN.';
      setSubjectsError(msg);
    }
  };

  const fetchDates = async () => {
    try {
      const r = await fetchWithTimeout(`${API_URL}?action=dates`);
      const d = await r.json();
      if (d.ok) setDates(d.items);
    } catch (e) {}
  };

  const fetchAnnouncement = async () => {
    try {
      const r = await fetchWithTimeout(`${API_URL}?action=get-announcement`);
      const d = await r.json();
      if (d.ok && d.announcement && d.announcement.text) {
        setAnnouncement(d.announcement.text);
        setAnnouncementVisible(true);
      } else setAnnouncement('');
    } catch (e) {}
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = `${API_URL}?action=schedule&date=${selectedDate}`;
      if (selectedSubject) url += `&subject=${encodeURIComponent(selectedSubject)}`;
      else if (selectedClass) url += `&class=${encodeURIComponent(selectedClass)}`;

      const r = await fetchWithTimeout(url);
      const d = await r.json();
      if (d.ok) {
        const s = d.items.sort((a: Lesson, b: Lesson) =>
          a.lesson_number !== b.lesson_number
            ? a.lesson_number - b.lesson_number
            : a.class_name.localeCompare(b.class_name)
        );
        setSchedule(s);
      } else {
        setError(d.error || 'Ошибка загрузки');
      }
    } catch (e: any) {
      const msg = e.name === 'AbortError'
        ? 'Превышено время ожидания. Отключите VPN.'
        : 'Не удалось загрузить расписание. Отключите VPN.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    const t = new Date();
    const tm = new Date(t); tm.setDate(tm.getDate() + 1);
    if (dt.toDateString() === t.toDateString()) return 'Сегодня';
    if (dt.toDateString() === tm.toDateString()) return 'Завтра';
    return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  const getDayOfWeek = (d: string) => new Date(d).toLocaleDateString('ru-RU', { weekday: 'short' });
  const selectDate = (d: string) => { setSelectedDate(d); setShowDatePicker(false); };

  const addDays = (n: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + n);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const parseTime = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  const getLessonStatus = (l: Lesson): 'past' | 'current' | 'future' => {
    const now = currentTime;
    const ld = new Date(l.schedule_date + 'T00:00:00');
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ldDay = new Date(ld.getFullYear(), ld.getMonth(), ld.getDate());
    if (ldDay < today) return 'past';
    if (ldDay > today) return 'future';
    const nm = now.getHours() * 60 + now.getMinutes();
    const s = parseTime(l.time_start);
    const e = parseTime(l.time_end);
    if (nm >= e) return 'past';
    if (nm >= s && nm < e) return 'current';
    return 'future';
  };

  useEffect(() => {
    if (schedule.length === 0) return;
    const now = currentTime;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sd = new Date(selectedDate + 'T00:00:00');
    const sdn = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate());
    if (sdn.getTime() !== today.getTime()) return;

    const nm = now.getHours() * 60 + now.getMinutes();
    let ci = -1;
    schedule.forEach((l, i) => {
      if (nm >= parseTime(l.time_start) && nm < parseTime(l.time_end)) ci = i;
    });

    if (ci >= 0 && !hasScrolledToCurrent.current && scrollViewRef.current) {
      setTimeout(() => {
        const ref = lessonRefs.current.get(ci);
        if (ref) ref.measureInWindow((x, y, w, h) => scrollViewRef.current?.scrollTo({ y: y - 100, animated: true }));
      }, 300);
      hasScrolledToCurrent.current = true;
    }
  }, [schedule, currentTime, selectedDate]);

  const filteredSubjects = subjects.filter(s => s.toLowerCase().includes(subjectSearch.toLowerCase()));
  const filteredClasses = classes.filter(c => c.toLowerCase().includes(classSearch.toLowerCase()));

  const countByStatus = (status: 'past' | 'current' | 'future') => {
    const filtered = schedule.filter(l => getLessonStatus(l) === status);
    if (selectedSubject) return filtered.length;
    const unique = new Set(filtered.map(l => l.lesson_number));
    return unique.size;
  };

  const pastLessons = countByStatus('past');
  const currentLessons = countByStatus('current');
  const futureLessons = countByStatus('future');

  const handleSubjectFilterPress = () => {
    if (subjectsError) {
      setSubjectsError(null);
      setSubjectsLoading(true);
      fetchSubjects().finally(() => setSubjectsLoading(false));
    } else if (subjects.length === 0 && !subjectsLoading) {
      setSubjectsLoading(true);
      fetchSubjects().finally(() => setSubjectsLoading(false));
    } else {
      setSubjectSearch('');
      setShowSubjectPicker(true);
    }
  };

  if (initialLoading) {
    return (
      <View style={splashStyles.container}>
        <View style={[splashStyles.circle, splashStyles.circle1]} />
        <View style={[splashStyles.circle, splashStyles.circle2]} />
        <View style={[splashStyles.circle, splashStyles.circle3]} />
        <Animated.View style={[splashStyles.logoContainer, { transform: [{ scale: Animated.multiply(logoScale, pulseAnim) }], opacity: logoOpacity }]}>
          <View style={splashStyles.logo}><Text style={splashStyles.logoIcon}></Text></View>
        </Animated.View>
        <Animated.Text style={[splashStyles.title, { opacity: titleOpacity }]}>Расписание</Animated.Text>
        <Animated.Text style={[splashStyles.subtitle, { opacity: subtitleOpacity }]}>Загрузка данных...</Animated.Text>
        <View style={splashStyles.progressContainer}>
          <View style={splashStyles.progressTrack}>
            <Animated.View style={[splashStyles.progressFill, { width: progressWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
          <Text style={splashStyles.progressText}>Подготовка к работе</Text>
        </View>
      </View>
    );
  }

  if (!selectedClass || showClassPickerScreen) {
    return (
      <View style={welcomeStyles.container}>
        <View style={[welcomeStyles.bgCircle, welcomeStyles.bgCircle1]} />
        <View style={[welcomeStyles.bgCircle, welcomeStyles.bgCircle2]} />
        <View style={[welcomeStyles.bgCircle, welcomeStyles.bgCircle3]} />
        <SafeAreaView style={welcomeStyles.safeArea}>
          <View style={welcomeStyles.headerBlock}>
            <View style={welcomeStyles.iconWrapper}>
              <View style={welcomeStyles.iconRing}>
                <Text style={welcomeStyles.iconEmoji}>🎓</Text>
              </View>
            </View>
            <Text style={welcomeStyles.title}>Расписание</Text>
            <Text style={welcomeStyles.subtitle}>Выберите ваш класс</Text>
          </View>
          <View style={welcomeStyles.content}>
            {classesLoading ? (
              <View style={welcomeStyles.stateContainer}>
                <View style={welcomeStyles.loaderWrapper}>
                  <ActivityIndicator size="large" color="#0EA5E9" />
                  <View style={welcomeStyles.loaderRing} />
                </View>
                <Text style={welcomeStyles.stateTitle}>Загрузка списка...</Text>
                <Text style={welcomeStyles.stateText}>Подождите немного</Text>
              </View>
            ) : classesError ? (
              <View style={welcomeStyles.stateContainer}>
                <View style={welcomeStyles.errorIconWrapper}>
                  <Text style={welcomeStyles.errorIcon}></Text>
                </View>
                <Text style={welcomeStyles.stateTitle}>Не удалось загрузить</Text>
                <Text style={welcomeStyles.stateText}>{classesError}</Text>
                <TouchableOpacity
                  style={welcomeStyles.retryButton}
                  onPress={() => { setClassesLoading(true); fetchClasses().finally(() => setClassesLoading(false)); }}
                  activeOpacity={0.7}
                >
                  <Text style={welcomeStyles.retryIcon}>↻</Text>
                  <Text style={welcomeStyles.retryText}>Попробовать снова</Text>
                </TouchableOpacity>
              </View>
            ) : classes.length === 0 ? (
              <View style={welcomeStyles.stateContainer}>
                <View style={welcomeStyles.emptyIconWrapper}>
                  <Text style={welcomeStyles.emptyIcon}>📭</Text>
                </View>
                <Text style={welcomeStyles.stateTitle}>Список пуст</Text>
                <Text style={welcomeStyles.stateText}>На сервере пока нет доступных классов</Text>
              </View>
            ) : (
              <>
                <View style={welcomeStyles.searchContainer}>
                  <Text style={welcomeStyles.searchIcon}>🔍</Text>
                  <TextInput
                    style={welcomeStyles.searchInput}
                    placeholder="Поиск класса..."
                    value={classSearch}
                    onChangeText={setClassSearch}
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
                  {classSearch ? (
                    <TouchableOpacity onPress={() => setClassSearch('')}>
                      <Text style={welcomeStyles.searchClear}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <ScrollView
                  style={welcomeStyles.scroll}
                  contentContainerStyle={welcomeStyles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={welcomeStyles.grid}>
                    {filteredClasses.map((cls, index) => {
                      const color = CLASS_CARD_COLORS[index % CLASS_CARD_COLORS.length];
                      const anim = cardAnims.get(cls) || {
                        scale: new Animated.Value(1),
                        opacity: new Animated.Value(1),
                      };
                      return (
                        <AnimatedClassCard
                          key={cls}
                          cls={cls}
                          color={color}
                          anim={anim}
                          onPress={() => saveClass(cls)}
                        />
                      );
                    })}
                  </View>
                  {filteredClasses.length === 0 && (
                    <View style={welcomeStyles.noResults}>
                      <Text style={welcomeStyles.noResultsText}>Ничего не найдено</Text>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
          {selectedClass && (
            <TouchableOpacity
              style={welcomeStyles.cancelButton}
              onPress={() => setShowClassPickerScreen(false)}
              activeOpacity={0.7}
            >
              <Text style={welcomeStyles.cancelText}>Отмена</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </View>
    );
  }

  function AnimatedClassCard({ cls, color, anim, onPress }: {
    cls: string;
    color: typeof CLASS_CARD_COLORS[number];
    anim: { scale: Animated.Value; opacity: Animated.Value };
    onPress: () => void;
  }) {
    const pressScale = useRef(new Animated.Value(1)).current;
    const onPressIn = () => {
      Animated.spring(pressScale, {
        toValue: 0.92,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    };
    const onPressOut = () => {
      Animated.spring(pressScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    };
    return (
      <Animated.View
        style={[
          welcomeStyles.cardWrapper,
          {
            opacity: anim.opacity,
            transform: [{ scale: Animated.multiply(anim.scale, pressScale) }],
          },
        ]}
      >
        <TouchableOpacity
          style={[welcomeStyles.card, { backgroundColor: color.bg, borderColor: color.border }]}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.85}
        >
          <Text style={[welcomeStyles.cardLabel, { color: color.border }]}>КЛАСС</Text>
          <Text style={[welcomeStyles.cardNumber, { color: color.text }]}>{cls}</Text>
          <View style={[welcomeStyles.cardArrow, { backgroundColor: color.border }]}>
            <Text style={welcomeStyles.cardArrowText}>→</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {announcement ? (
        <Animated.View style={[styles.announcementBanner, { maxHeight: announcementHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }), opacity: announcementHeight }]}>
          <View style={styles.announcementContent}>
            <View style={styles.announcementIconContainer}><Text style={styles.announcementIcon}>📢</Text></View>
            <Text style={styles.announcementText} numberOfLines={3}>{announcement}</Text>
            <TouchableOpacity style={styles.announcementClose} onPress={() => setAnnouncementVisible(false)} activeOpacity={0.7}>
              <Text style={styles.announcementCloseText}></Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Расписание</Text>
            <Text style={styles.headerSubtitle}>{selectedSubject ? `📚 ${selectedSubject}` : `🏫 ${selectedClass}`}</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={() => setShowClassPickerScreen(true)} activeOpacity={0.7}>
              <Text style={styles.headerButtonText}>Выбор класса</Text>
            </TouchableOpacity>
          </View>
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
            <View style={styles.statItem}><Text style={styles.statNumber}>{pastLessons}</Text><Text style={styles.statLabel}>пройдено</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={[styles.statNumber, styles.statNumberCurrent]}>{currentLessons}</Text><Text style={styles.statLabel}>сейчас</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={styles.statNumber}>{futureLessons}</Text><Text style={styles.statLabel}>впереди</Text></View>
          </View>
        )}
      </View>

      <View style={styles.subjectFilterContainer}>
        <TouchableOpacity
          style={styles.subjectFilterButton}
          onPress={handleSubjectFilterPress}
          activeOpacity={0.7}
        >
          {subjectsError ? (
            <Text style={styles.subjectFilterIcon}>📡</Text>
          ) : (
            <Text style={styles.subjectFilterIcon}>📖</Text>
          )}
          {subjectsLoading ? (
            <ActivityIndicator size="small" color="#0EA5E9" />
          ) : subjectsError ? (
            <Text style={[styles.subjectFilterText, { color: '#EF4444' }]}>Ошибка загрузки (нажмите для повтора)</Text>
          ) : (
            <Text style={styles.subjectFilterText}>{selectedSubject || 'Все предметы'}</Text>
          )}
          {selectedSubject && (
            <TouchableOpacity style={styles.clearSubject} onPress={(e) => { e.stopPropagation(); setSelectedSubject(''); }}>
              <Text style={styles.clearSubjectText}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.timelineContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSchedule} tintColor="#0EA5E9" />}
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>📡</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchSchedule} activeOpacity={0.7}>
              <Text style={styles.retryText}>Повторить</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>Загрузка расписания...</Text>
          </View>
        ) : schedule.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>Нет уроков</Text>
            <Text style={styles.emptyText}>{selectedSubject ? `По предмету "${selectedSubject}" уроков не найдено` : 'На этот день расписание ещё не добавлено'}</Text>
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
                  <View style={[styles.timelineDot, isCurrent && styles.timelineDotCurrent, isPast && styles.timelineDotPast]}>
                    {isCurrent && <View style={styles.timelineDotPulse} />}
                    <Text style={[styles.timelineDotText, isCurrent && styles.timelineDotTextCurrent, isPast && styles.timelineDotTextPast]}>
                      {lesson.lesson_number}
                    </Text>
                  </View>
                  <View style={[styles.lessonCard, isCurrent && styles.lessonCardCurrent, isPast && styles.lessonCardPast]}>
                    <View style={styles.lessonHeader}>
                      <View style={styles.lessonTimeBlock}>
                        <Text style={[styles.lessonTime, isCurrent && styles.lessonTimeCurrent, isPast && styles.lessonTimePast]}>{lesson.time_start}</Text>
                        <Text style={[styles.lessonTimeEnd, isPast && styles.lessonTimePast]}>{lesson.time_end}</Text>
                      </View>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <View style={styles.currentBadgeDot} />
                          <Text style={styles.currentBadgeText}>Сейчас</Text>
                        </View>
                      )}
                      {isPast && <Text style={styles.pastBadge}>Пройден</Text>}
                    </View>
                    {selectedSubject && <Text style={[styles.lessonClass, isPast && styles.lessonClassPast]}>{lesson.class_name}</Text>}
                    <Text style={[styles.lessonSubject, isPast && styles.lessonSubjectPast]} numberOfLines={2}>{lesson.subject}</Text>
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

      <SubjectModal visible={showSubjectPicker} onClose={() => setShowSubjectPicker(false)}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск предмета..."
            value={subjectSearch}
            onChangeText={setSubjectSearch}
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            returnKeyType="search"
          />
          {subjectSearch ? (
            <TouchableOpacity onPress={() => setSubjectSearch('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView style={styles.modalScrollSubject} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
          <TouchableOpacity
            style={[styles.subjectListItem, !selectedSubject && styles.subjectListItemSelected]}
            onPress={() => { setSelectedSubject(''); setShowSubjectPicker(false); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.subjectListItemText, !selectedSubject && styles.subjectListItemTextSelected]}>Все предметы</Text>
            {!selectedSubject && <Text style={styles.subjectListCheck}>✓</Text>}
          </TouchableOpacity>
          {filteredSubjects.map((subj) => (
            <TouchableOpacity
              key={subj}
              style={[styles.subjectListItem, selectedSubject === subj && styles.subjectListItemSelected]}
              onPress={() => { setSelectedSubject(subj); setShowSubjectPicker(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.subjectListItemText, selectedSubject === subj && styles.subjectListItemTextSelected]}>{subj}</Text>
              {selectedSubject === subj && <Text style={styles.subjectListCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
          {filteredSubjects.length === 0 && (
            <View style={styles.noResults}><Text style={styles.noResultsText}>Ничего не найдено</Text></View>
          )}
        </ScrollView>
        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSubjectPicker(false)} activeOpacity={0.7}>
          <Text style={styles.modalCloseText}>Отмена</Text>
        </TouchableOpacity>
      </SubjectModal>

      <SwipeableModal visible={showDatePicker} onClose={() => setShowDatePicker(false)}>
        <Text style={modalStyles.modalTitle}>Выберите дату</Text>
        <ScrollView style={styles.modalScroll}>
          {dates.map((date) => (
            <TouchableOpacity
              key={date}
              style={[styles.dateOption, selectedDate === date && styles.dateOptionSelected]}
              onPress={() => selectDate(date)}
              activeOpacity={0.7}
            >
              <Text style={styles.dateOptionDay}>{getDayOfWeek(date)}</Text>
              <Text style={[styles.dateOptionText, selectedDate === date && styles.dateOptionTextSelected]}>{formatDate(date)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
          <Text style={styles.modalCloseText}>Отмена</Text>
        </TouchableOpacity>
      </SwipeableModal>
    </SafeAreaView>
  );
}

const welcomeStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF', position: 'relative', overflow: 'hidden' },
  safeArea: { flex: 1 },
  bgCircle: { position: 'absolute', borderRadius: 9999, opacity: 0.5 },
  bgCircle1: { width: 280, height: 280, backgroundColor: '#BAE6FD', top: -120, right: -100 },
  bgCircle2: { width: 220, height: 220, backgroundColor: '#E0F2FE', bottom: -80, left: -80 },
  bgCircle3: { width: 140, height: 140, backgroundColor: '#7DD3FC', top: '35%', right: -40, opacity: 0.3 },
  headerBlock: { alignItems: 'center', paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24 },
  iconWrapper: { marginBottom: 16 },
  iconRing: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#0EA5E9',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  iconEmoji: { fontSize: 44 },
  title: { fontSize: 32, fontWeight: '800', color: '#0C4A6E', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#64748B', fontWeight: '500', marginBottom: 14 },
  content: { flex: 1, paddingHorizontal: 20 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    marginBottom: 16, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD',
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#0C4A6E' },
  searchClear: { fontSize: 18, color: '#64748B', padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  stateTitle: { fontSize: 20, fontWeight: '700', color: '#0C4A6E', marginTop: 20, marginBottom: 8, textAlign: 'center' },
  stateText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  loaderWrapper: { position: 'relative', width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  loaderRing: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#BAE6FD' },
  errorIconWrapper: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FECACA',
  },
  errorIcon: { fontSize: 44 },
  emptyIconWrapper: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#FEF3C7',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FDE68A',
  },
  emptyIcon: { fontSize: 44 },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0EA5E9',
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  retryIcon: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginRight: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cardWrapper: { width: '31%', marginBottom: 12 },
  card: {
    aspectRatio: 1, borderRadius: 16, borderWidth: 2, justifyContent: 'center', alignItems: 'center', padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    position: 'relative', overflow: 'hidden',
  },
  cardLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4, opacity: 0.7 },
  cardNumber: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  cardArrow: {
    position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  cardArrowText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  noResults: { paddingVertical: 20, alignItems: 'center' },
  noResultsText: { fontSize: 15, color: '#64748B' },
  cancelButton: {
    marginHorizontal: 20, marginTop: 10, marginBottom: 20, backgroundColor: '#F0F9FF',
    paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#BAE6FD',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#0EA5E9' },
});

const splashStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  circle: { position: 'absolute', borderRadius: 9999, opacity: 0.08 },
  circle1: { width: 300, height: 300, backgroundColor: '#0EA5E9', top: -100, right: -100 },
  circle2: { width: 200, height: 200, backgroundColor: '#7DD3FC', bottom: -50, left: -80 },
  circle3: { width: 150, height: 150, backgroundColor: '#0284C7', top: '40%', left: -60 },
  logoContainer: { marginBottom: 24 },
  logo: {
    width: 120, height: 120, borderRadius: 32, backgroundColor: '#0EA5E9',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  logoIcon: { fontSize: 64 },
  title: { fontSize: 36, fontWeight: '800', color: '#0C4A6E', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#64748B', marginBottom: 40, fontWeight: '500' },
  progressContainer: { width: '70%', alignItems: 'center', gap: 12 },
  progressTrack: { width: '100%', height: 6, backgroundColor: '#BAE6FD', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#0EA5E9', borderRadius: 3 },
  progressText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  keyboardAvoidingContainer: { flex: 1, justifyContent: 'flex-end' },
  header: { backgroundColor: '#FFFFFF', paddingTop: 16, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#BAE6FD' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0C4A6E', marginBottom: 2 },
  headerSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  headerButton: { backgroundColor: '#0EA5E9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  headerButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  resetButton: { backgroundColor: '#EF4444' },
  dateNav: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', borderRadius: 14, padding: 4 },
  dateNavButton: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  dateNavIcon: { fontSize: 24, color: '#0EA5E9', fontWeight: '300', marginTop: -4 },
  dateDisplay: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  dateDay: { fontSize: 11, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  dateText: { fontSize: 14, fontWeight: '700', color: '#0C4A6E' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingVertical: 8 },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#0C4A6E' },
  statNumberCurrent: { color: '#0EA5E9' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#BAE6FD' },
  subjectFilterContainer: { padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#BAE6FD' },
  subjectFilterButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF',
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#BAE6FD',
  },
  subjectFilterIcon: { fontSize: 20, marginRight: 10 },
  subjectFilterText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0C4A6E' },
  clearSubject: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#BAE6FD', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  clearSubjectText: { fontSize: 14, color: '#64748B', fontWeight: 'bold' },
  timelineContainer: { paddingVertical: 16 },
  timeline: { position: 'relative', paddingHorizontal: 16 },
  timelineLine: { position: 'absolute', left: 38, top: 24, bottom: 24, width: 2, backgroundColor: '#BAE6FD' },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  timelineItemCurrent: {},
  timelineDot: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#0EA5E9',
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  timelineDotCurrent: {
    backgroundColor: '#0EA5E9', borderColor: '#0EA5E9',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 5,
  },
  timelineDotPast: { borderColor: '#9CA3AF', backgroundColor: '#9CA3AF' },
  timelineDotPulse: { position: 'absolute', width: '100%', height: '100%', borderRadius: 20, backgroundColor: '#0EA5E9', opacity: 0.4 },
  timelineDotText: { fontSize: 14, fontWeight: '800', color: '#0EA5E9' },
  timelineDotTextCurrent: { color: '#FFFFFF' },
  timelineDotTextPast: { color: '#FFFFFF' },
  timelineEnd: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#BAE6FD', marginLeft: 33, marginTop: 8 },
  lessonCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginLeft: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderLeftWidth: 4, borderLeftColor: '#0EA5E9',
  },
  lessonCardCurrent: {
    backgroundColor: '#E0F2FE', borderLeftColor: '#0EA5E9',
    shadowColor: '#0EA5E9', shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
  },
  lessonCardPast: { opacity: 0.6, borderLeftColor: '#9CA3AF' },
  lessonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lessonTimeBlock: { flexDirection: 'row', alignItems: 'baseline' },
  lessonTime: { fontSize: 16, fontWeight: '800', color: '#0C4A6E', marginRight: 4 },
  lessonTimeCurrent: { color: '#0EA5E9' },
  lessonTimePast: { color: '#9CA3AF' },
  lessonTimeEnd: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  currentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0EA5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  currentBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginRight: 6 },
  currentBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  pastBadge: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  lessonClass: { fontSize: 11, fontWeight: '700', color: '#0EA5E9', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  lessonClassPast: { color: '#9CA3AF' },
  lessonSubject: { fontSize: 17, fontWeight: '700', color: '#0C4A6E', marginBottom: 10, lineHeight: 22 },
  lessonSubjectPast: { color: '#9CA3AF' },
  lessonDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  detailIcon: { fontSize: 12, marginRight: 4 },
  detailText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { marginTop: 16, color: '#64748B', fontSize: 15, fontWeight: '500' },
  errorContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  errorEmoji: { fontSize: 64, marginBottom: 16 },
  errorText: { color: '#64748B', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#0EA5E9', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 72, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0C4A6E', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  bottomSpacing: { height: 20 },
  announcementBanner: { backgroundColor: '#FFF7ED', borderBottomWidth: 1, borderBottomColor: '#FED7AA', overflow: 'hidden' },
  announcementContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  announcementIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  announcementIcon: { fontSize: 18 },
  announcementText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#9A3412', lineHeight: 20 },
  announcementClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FED7AA', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  announcementCloseText: { fontSize: 14, color: '#9A3412', fontWeight: 'bold' },
  modalScroll: { maxHeight: 500, paddingHorizontal: 20 },
  modalScrollSubject: { maxHeight: 400, paddingHorizontal: 20 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF',
    marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD',
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#0C4A6E' },
  searchClear: { fontSize: 18, color: '#64748B', padding: 4 },
  subjectListItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#F0F9FF', borderRadius: 12, marginBottom: 8,
  },
  subjectListItemSelected: { backgroundColor: '#0EA5E9' },
  subjectListItemText: { fontSize: 15, fontWeight: '600', color: '#0C4A6E', flex: 1 },
  subjectListItemTextSelected: { color: '#FFFFFF' },
  subjectListCheck: { fontSize: 20, color: '#0EA5E9', fontWeight: '600', marginLeft: 8 },
  noResults: { paddingVertical: 20, alignItems: 'center' },
  noResultsText: { fontSize: 15, color: '#64748B' },
  dateOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: '#F0F9FF', borderRadius: 12, marginBottom: 8,
  },
  dateOptionSelected: { backgroundColor: '#0EA5E9' },
  dateOptionDay: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', width: 50, letterSpacing: 1 },
  dateOptionText: { fontSize: 14, fontWeight: '600', color: '#0C4A6E', flex: 1 },
  dateOptionTextSelected: { color: '#FFFFFF' },
  modalCloseButton: { marginHorizontal: 20, marginTop: 10, backgroundColor: '#F0F9FF', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalCloseText: { fontSize: 15, fontWeight: '700', color: '#0EA5E9' },
});