import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CalendarPickerProps {
  selectedDate?: string; // Format: YYYY-MM-DD or DD/MM/YYYY
  onSelectDate: (dateStr: string) => void;
  onClear?: () => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

const MONTH_NAMES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const WEEKDAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  selectedDate,
  onSelectDate,
  onClear,
  onClose,
  isDarkMode = true,
}) => {
  // Parse initial date or default to current date
  const parseInitialDate = () => {
    if (!selectedDate) return new Date();
    if (selectedDate.includes('/')) {
      const parts = selectedDate.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          return new Date(y, m, d);
        }
      }
    } else if (selectedDate.includes('-')) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          return new Date(y, m, d);
        }
      }
    }
    return new Date();
  };

  const initial = parseInitialDate();
  const [currentYear, setCurrentYear] = useState<number>(initial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initial.getMonth());
  const [showMonthSelect, setShowMonthSelect] = useState<boolean>(false);

  // Today Date
  const today = new Date();

  // Selected Date representation
  let selectedYear = -1;
  let selectedMonth = -1;
  let selectedDay = -1;

  if (selectedDate) {
    const dt = parseInitialDate();
    selectedYear = dt.getFullYear();
    selectedMonth = dt.getMonth();
    selectedDay = dt.getDate();
  }

  // Prev / Next Month
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Generate Matrix of Days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon...
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const daysGrid: { day: number; isCurrentMonth: boolean; dateObj: Date }[] = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const prevDay = daysInPrevMonth - i;
    const dateObj = new Date(
      currentMonth === 0 ? currentYear - 1 : currentYear,
      currentMonth === 0 ? 11 : currentMonth - 1,
      prevDay
    );
    daysGrid.push({ day: prevDay, isCurrentMonth: false, dateObj });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(currentYear, currentMonth, d);
    daysGrid.push({ day: d, isCurrentMonth: true, dateObj });
  }

  // Next month leading days
  const remainingCells = 42 - daysGrid.length; // 6 rows * 7 cols = 42
  for (let d = 1; d <= remainingCells; d++) {
    const dateObj = new Date(
      currentMonth === 11 ? currentYear + 1 : currentYear,
      currentMonth === 11 ? 0 : currentMonth + 1,
      d
    );
    daysGrid.push({ day: d, isCurrentMonth: false, dateObj });
  }

  const handleSelectDay = (dateObj: Date) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const formattedDate = `${d}/${m}/${y}`;
    onSelectDate(formattedDate);
  };

  const handleSelectToday = () => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${d}/${m}/${y}`;
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    onSelectDate(formattedDate);
  };

  return (
    <div
      className={`w-72 p-3.5 rounded-2xl shadow-2xl border transition-all z-50 select-none ${
        isDarkMode
          ? 'bg-[#181a1b] border-[#2e3235] text-white'
          : 'bg-white border-[#d1d7db] text-[#111b21]'
      }`}
    >
      {/* Calendar Top Header */}
      <div className="flex items-center justify-between pb-3 mb-1 border-b border-white/10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMonthSelect(!showMonthSelect)}
            className={`flex items-center space-x-1.5 text-sm font-semibold capitalize transition-colors cursor-pointer px-2 py-1 rounded-lg ${
              isDarkMode
                ? 'hover:bg-[#2a3036] text-white'
                : 'hover:bg-[#f0f2f5] text-[#111b21]'
            }`}
          >
            <span>
              {MONTH_NAMES_PT[currentMonth]} de {currentYear}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {/* Quick Month Selector Popup */}
          {showMonthSelect && (
            <div
              className={`absolute top-full left-0 mt-1 w-48 max-h-48 overflow-y-auto rounded-xl border shadow-xl z-50 p-1 ${
                isDarkMode
                  ? 'bg-[#222528] border-[#33383d] text-white'
                  : 'bg-white border-gray-200 text-black'
              }`}
            >
              {MONTH_NAMES_PT.map((mName, idx) => (
                <button
                  key={mName}
                  type="button"
                  onClick={() => {
                    setCurrentMonth(idx);
                    setShowMonthSelect(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    currentMonth === idx
                      ? 'bg-[#00a884] text-white font-bold'
                      : isDarkMode
                      ? 'hover:bg-[#2e343a]'
                      : 'hover:bg-[#f0f2f5]'
                  }`}
                >
                  {mName} {currentYear}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Up / Down or Left / Right Nav Arrows */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            title="Mês anterior"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDarkMode
                ? 'hover:bg-[#2a3036] text-[#aebac1] hover:text-white'
                : 'hover:bg-[#f0f2f5] text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            title="Próximo mês"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDarkMode
                ? 'hover:bg-[#2a3036] text-[#aebac1] hover:text-white'
                : 'hover:bg-[#f0f2f5] text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 text-center mb-1">
        {WEEKDAYS_PT.map((day, idx) => (
          <div
            key={idx}
            className={`text-xs font-bold py-1 ${
              isDarkMode ? 'text-[#8696a0]' : 'text-[#8696a0]'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Matrix */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {daysGrid.map((item, index) => {
          const isSelected =
            selectedYear === item.dateObj.getFullYear() &&
            selectedMonth === item.dateObj.getMonth() &&
            selectedDay === item.dateObj.getDate();

          const isTodayDay =
            today.getFullYear() === item.dateObj.getFullYear() &&
            today.getMonth() === item.dateObj.getMonth() &&
            today.getDate() === item.dateObj.getDate();

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectDay(item.dateObj)}
              className={`h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#3b82f6] text-white font-bold ring-2 ring-blue-400/50 shadow-md scale-105'
                  : !item.isCurrentMonth
                  ? isDarkMode
                    ? 'text-[#54656f] hover:bg-[#252a2f]'
                    : 'text-[#aebac1] hover:bg-[#f0f2f5]'
                  : isTodayDay
                  ? isDarkMode
                    ? 'border border-[#00a884] text-[#00a884] font-bold hover:bg-[#2a3036]'
                    : 'border border-[#00a884] text-[#00a884] font-bold hover:bg-[#f0f2f5]'
                  : isDarkMode
                  ? 'text-[#e9edef] hover:bg-[#2a3036]'
                  : 'text-[#111b21] hover:bg-[#f0f2f5]'
              }`}
            >
              {item.day}
            </button>
          );
        })}
      </div>

      {/* Calendar Footer Actions */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/10 text-xs">
        <button
          type="button"
          onClick={() => {
            if (onClear) onClear();
          }}
          className={`font-medium transition-colors cursor-pointer ${
            isDarkMode ? 'text-[#8696a0] hover:text-white' : 'text-[#54656f] hover:text-black'
          }`}
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleSelectToday}
          className="text-[#3b82f6] hover:text-blue-400 font-semibold transition-colors cursor-pointer"
        >
          Hoje
        </button>
      </div>
    </div>
  );
};
