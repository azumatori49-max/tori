/**
 * datasource/calendar.js — 祝日・祝前日の判定
 *
 * Google の日本の祝日カレンダーを参照する（認証は GAS の CalendarApp で完結）。
 * 祝前日（翌日が祝日 or 土曜）は居酒屋では係数が大きい（§4-2）。
 */

const HOLIDAY_CAL_ID = 'ja.japanese#holiday@group.v.calendar.google.com';

function isJapaneseHoliday_(date) {
  const cal = CalendarApp.getCalendarById(HOLIDAY_CAL_ID);
  if (!cal) return false;
  return cal.getEventsForDay(date).length > 0;
}

/**
 * 祝前日か。翌日が祝日なら true。
 * 「金曜・土曜が強い」は曜日係数側で表現するため、ここでは祝日の前日のみを見る。
 */
function isEveOfHoliday_(date) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + 1);
  return isJapaneseHoliday_(next);
}
