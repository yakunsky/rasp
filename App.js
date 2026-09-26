import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ActivityIndicator, 
  ScrollView, SafeAreaView, TouchableOpacity, RefreshControl 
} from 'react-native';

export default function App() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Функция для "очистки" HTML и превращения его в удобный формат
  const parseSchedule = (html) => {
    const groups = [];
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let match;
    let index = 0;
    // Заголовки групп на основе структуры сайта
    const headers = ['5-6 Классы', '7-8 Классы', '9-11 Классы'];
    
    while ((match = tableRegex.exec(html)) !== null) {
      const tableHtml = match[0];
      const header = headers[index] || `Группа ${index + 1}`;
      
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      const rows = [];
      
      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const rowHtml = rowMatch[0];
        const cellRegex = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
        let cellMatch;
        const cells = [];
        
        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
          let cellContent = cellMatch[2];
          // Заменяем <br> на перенос строки
          cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
          // Удаляем все остальные HTML-теги
          cellContent = cellContent.replace(/<[^>]+>/g, '');
          // Заменяем &nbsp; на пробел и убираем лишние пробелы
          cellContent = cellContent.replace(/&nbsp;/g, ' ').trim();
          cells.push(cellContent);
        }
        if (cells.length > 0) {
          rows.push(cells);
        }
      }
      if (rows.length > 0) {
        groups.push({ header, rows });
      }
      index++;
    }
    return groups;
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Делаем запрос, притворяясь обычным браузером, чтобы сайт нас не заблокировал
      const response = await fetch('https://r.ykcloud.ru/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error('Ошибка сети');
      }
      
      const html = await response.text();
      const parsedData = parseSchedule(html);
      setSchedule(parsedData);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить расписание. Проверьте интернет или попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  if (loading && schedule.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Загрузка расписания...</Text>
      </View>
    );
  }

  if (error && schedule.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchSchedule}>
          <Text style={styles.retryText}>Попробовать снова</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Расписание занятий</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchSchedule}>
          <Text style={styles.refreshText}>🔄 Обновить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSchedule} />}
      >
        {schedule.map((group, groupIndex) => (
          <View key={groupIndex} style={styles.groupContainer}>
            <Text style={styles.groupHeader}>{group.header}</Text>
            
            {/* Горизонтальная прокрутка для таблицы, чтобы она не сжималась на телефоне */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={styles.table}>
                {group.rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.row}>
                    {row.map((cell, cellIndex) => (
                      <Text 
                        key={cellIndex} 
                        style={[
                          styles.cell, 
                          rowIndex === 0 ? styles.headerCell : styles.dataCell
                        ]}
                      >
                        {cell || '—'}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContainer: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  groupContainer: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#007AFF',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cell: {
    flex: 1,
    padding: 10,
    fontSize: 13,
    minWidth: 70, // Минимальная ширина ячейки для читаемости
  },
  headerCell: {
    backgroundColor: '#f0f4f8',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  dataCell: {
    color: '#555',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  }
});