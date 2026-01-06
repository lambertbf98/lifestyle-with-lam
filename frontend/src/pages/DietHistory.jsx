import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { diet as dietApi } from '../api';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronLeft, ChevronRight, Flame, Calendar, ArrowLeft, UtensilsCrossed } from 'lucide-react';

const mealTypeLabels = {
  breakfast: 'Desayuno',
  mid_morning: 'Media Mañana',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena'
};

const mealTypeIcons = {
  breakfast: '🌅',
  mid_morning: '🥤',
  lunch: '☀️',
  snack: '💪',
  dinner: '🌙'
};

export default function DietHistory() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [historyDates, setHistoryDates] = useState([]);
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);

  // Get calendar data for current month and select today on first load
  useEffect(() => {
    loadHistoryDates();
  }, [currentDate]);

  // Select today by default on first load
  useEffect(() => {
    const today = new Date();
    loadDayData(today);
  }, []);

  const loadHistoryDates = async () => {
    setLoading(true);
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const response = await dietApi.getHistoryDates(month, year);
      setHistoryDates(response.data);
    } catch (error) {
      console.error('Error loading history dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDayData = async (date) => {
    setLoadingDay(true);
    try {
      // Use local date formatting to avoid timezone conversion issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const response = await dietApi.getHistory(dateStr);
      setDayData(response.data);
      setSelectedDate(date);
    } catch (error) {
      console.error('Error loading day data:', error);
    } finally {
      setLoadingDay(false);
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const formatDateKey = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getDateInfo = (day) => {
    const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
    return historyDates.find(d => d.date === dateKey);
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() &&
           currentDate.getMonth() === today.getMonth() &&
           currentDate.getFullYear() === today.getFullYear();
  };

  const isFutureDate = (day) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return checkDate > today;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setSelectedDate(null);
    setDayData(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setSelectedDate(null);
    setDayData(null);
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="p-4 space-y-6 safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-dark-700 hover:bg-dark-600' : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Historial de Dietas</h1>
          <p className="text-sm text-gray-500">Revisa lo que comiste cada día</p>
        </div>
      </div>

      {/* Calendar */}
      <div className={`rounded-2xl p-4 ${isDark ? 'bg-dark-800 border border-dark-600' : 'bg-white border border-gray-200'}`}>
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-dark-700 hover:bg-dark-600' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={nextMonth}
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-dark-700 hover:bg-dark-600' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center text-xs text-gray-500 font-medium py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: startingDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateInfo = getDateInfo(day);
            const hasData = !!dateInfo;
            const today = isToday(day);
            const future = isFutureDate(day);
            const isSelected = selectedDate?.getDate() === day &&
                              selectedDate?.getMonth() === currentDate.getMonth();

            return (
              <button
                key={day}
                onClick={() => !future && loadDayData(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                disabled={future}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-all ${
                  isSelected
                    ? 'bg-accent-primary text-dark-900 font-bold'
                    : today
                      ? isDark
                        ? 'bg-dark-600 ring-2 ring-accent-primary'
                        : 'bg-gray-200 ring-2 ring-accent-primary'
                      : future
                        ? isDark
                          ? 'text-gray-700 cursor-not-allowed'
                          : 'text-gray-300 cursor-not-allowed'
                        : hasData
                          ? isDark
                            ? 'bg-dark-700 hover:bg-dark-600'
                            : 'bg-gray-100 hover:bg-gray-200'
                          : isDark
                            ? 'text-gray-400 hover:bg-dark-700/50'
                            : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span>{day}</span>
                {hasData && !isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-success mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Data */}
      {selectedDate && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar size={20} className="text-accent-primary" />
            {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>

          {loadingDay ? (
            <div className={`rounded-2xl p-8 text-center ${isDark ? 'bg-dark-800' : 'bg-white'}`}>
              <div className="animate-pulse">Cargando...</div>
            </div>
          ) : dayData && dayData.meals.length > 0 ? (
            <>
              {/* Totals */}
              <div className={`rounded-2xl p-4 ${isDark ? 'bg-dark-800 border border-dark-600' : 'bg-white border border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Flame size={20} className="text-accent-warning" />
                  <span className="font-semibold">Resumen del Día</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold text-accent-warning">{dayData.totals.calories}</p>
                    <p className="text-xs text-gray-500">kcal</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-accent-danger">{Math.round(dayData.totals.protein)}g</p>
                    <p className="text-xs text-gray-500">Proteína</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-accent-primary">{Math.round(dayData.totals.carbs)}g</p>
                    <p className="text-xs text-gray-500">Carbos</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-neon-purple">{Math.round(dayData.totals.fat)}g</p>
                    <p className="text-xs text-gray-500">Grasas</p>
                  </div>
                </div>
              </div>

              {/* Meals List */}
              <div className="space-y-3">
                {dayData.meals.map((meal, index) => (
                  <div
                    key={index}
                    className={`rounded-xl p-4 ${isDark ? 'bg-dark-800 border border-dark-600' : 'bg-white border border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {mealTypeIcons[meal.meal_type] || '🍽️'}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">
                          {meal.meal_name || meal.custom_meal_name || mealTypeLabels[meal.meal_type] || 'Comida'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {meal.calories} kcal • P: {meal.protein_grams}g • C: {meal.carbs_grams}g • G: {meal.fat_grams}g
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={`rounded-2xl p-8 text-center ${isDark ? 'bg-dark-800' : 'bg-white'}`}>
              <UtensilsCrossed size={40} className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">No hay datos para este día</p>
            </div>
          )}
        </div>
      )}

      {/* No selection prompt */}
      {!selectedDate && !loading && (
        <div className={`rounded-2xl p-8 text-center ${isDark ? 'bg-dark-800/50' : 'bg-white/50'}`}>
          <Calendar size={40} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500">Selecciona un día para ver el historial</p>
          <p className="text-xs text-gray-400 mt-1">Los días con punto verde tienen comidas registradas</p>
        </div>
      )}
    </div>
  );
}
