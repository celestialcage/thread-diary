import { CalendarDays, X } from "lucide-react";
import { useMemo, type FC } from "react";

export interface DailyCount {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

interface ActivityHeatmapProps {
  data: DailyCount[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  weeksToShow?: number; // 기본 최근 24주(약 6개월)
}

export const ActivityHeatmap: FC<ActivityHeatmapProps> = ({
  data,
  selectedDate,
  onSelectDate,
  weeksToShow = 24,
}) => {
  // 날짜별 카운트 빠른 조회를 위한 Map
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => map.set(item.date, item.count));
    return map;
  }, [data]);

  // 오늘 기준으로 역산하여 주(Column) x 요일(Row, 일~토) 2차원 배열 생성
  const gridWeeks = useMemo(() => {
    const today = new Date();
    const endDayOfWeek = today.getDay(); // 0(일) ~ 6(토)
    const totalDays = (weeksToShow - 1) * 7 + (endDayOfWeek + 1);

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (totalDays - 1));

    const weeks: { dateStr: string; count: number; isFuture: boolean }[][] = [];
    let currentWeek: { dateStr: string; count: number; isFuture: boolean }[] =
      [];

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      // 로컬 타임존 기준 YYYY-MM-DD 포맷팅
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      currentWeek.push({
        dateStr,
        count: countMap.get(dateStr) || 0,
        isFuture: d > today,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    return weeks;
  }, [countMap, weeksToShow]);

  // 기록 수에 따른 다크 모드 에메랄드/스카이 컬러 단계
  const getCellColor = (count: number, isSelected: boolean) => {
    if (isSelected) return "bg-sky-400 ring-2 ring-sky-300";
    if (count === 0) return "bg-neutral-900 border border-neutral-800/80";
    if (count === 1) return "bg-emerald-950 border border-emerald-800/60";
    if (count <= 3) return "bg-emerald-700";
    if (count <= 5) return "bg-emerald-500";
    return "bg-emerald-400";
  };

  return (
    <div className="px-4 py-3 border-b border-neutral-800/80 bg-neutral-950/40">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
          <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
          <span>생각의 발자취</span>
          {selectedDate && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] flex items-center gap-1">
              {selectedDate}
              <button
                type="button"
                onClick={() => onSelectDate(null)}
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {/* 범례 (적음 ~ 많음) */}
        <div className="flex items-center gap-1 text-[10px] text-neutral-500">
          <span>적음</span>
          <span className="w-2.5 h-2.5 rounded-[2px] bg-neutral-900 border border-neutral-800" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-950" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-700" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400" />
          <span>많음</span>
        </div>
      </div>

      {/* 잔디 그리드 */}
      <div className="flex gap-1 overflow-x-auto pb-1 justify-between">
        {gridWeeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1">
            {week.map((day) => {
              const isSelected = selectedDate === day.dateStr;
              return (
                <button
                  key={day.dateStr}
                  type="button"
                  disabled={day.isFuture}
                  onClick={() => onSelectDate(isSelected ? null : day.dateStr)}
                  title={`${day.dateStr}: ${day.count}개의 기록`}
                  className={`w-3 h-3 rounded-[2.5px] transition-transform hover:scale-125 ${getCellColor(
                    day.count,
                    isSelected,
                  )}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
