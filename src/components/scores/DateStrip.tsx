import { useMemo, useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n';
import { usePrefetch } from '../../data/queries';
import { addDays, parseDayKey, todayKey } from '../../lib/time';
import s from './scores.module.css';

/** Days around the selected date, with arrows and a native date picker for longer jumps. */
export function DateStrip({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  const i18n = useI18n();
  const prefetch = usePrefetch();
  const today = todayKey();
  const picker = useRef<HTMLInputElement>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(value, i - 3)), [value]);

  return (
    <div className={s.dateStrip} role="group" aria-label={i18n.t('pickDate')}>
      <button
        type="button"
        className={s.dateArrow}
        onClick={() => onChange(addDays(value, -1))}
        onPointerEnter={() => prefetch.day(addDays(value, -1))}
        aria-label={i18n.t('prevDay')}
      >
        <ChevronLeft size={18} />
      </button>
      <div className={s.dateDays}>
        {days.map((d) => {
          const date = parseDayKey(d);
          const selected = d === value;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              className={`${s.day} ${selected ? s.daySelected : ''} ${isToday ? s.dayToday : ''}`}
              aria-pressed={selected}
              aria-label={i18n.dateLong(date.toISOString())}
              onClick={() => onChange(d)}
              onPointerEnter={() => prefetch.day(d)}
              onFocus={() => prefetch.day(d)}
              onTouchStart={() => prefetch.day(d)}
            >
              <span className={s.dayName}>{i18n.dayLabel(d)}</span>
              <span className={s.dayDate}>{i18n.dayMonth(date)}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={s.dateArrow}
        onClick={() => onChange(addDays(value, 1))}
        onPointerEnter={() => prefetch.day(addDays(value, 1))}
        aria-label={i18n.t('nextDay')}
      >
        <ChevronRight size={18} />
      </button>
      <label className={s.datePick} title={i18n.t('pickDate')}>
        <CalendarDays size={18} aria-hidden />
        <span className="sr-only">{i18n.t('pickDate')}</span>
        <input
          ref={picker}
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={() => picker.current?.showPicker?.()}
        />
      </label>
    </div>
  );
}
