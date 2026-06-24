import dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
import "dayjs/locale/pt-br";

dayjs.extend(calendar);
dayjs.locale("pt-br");

const calendarFormats = {
	sameDay: "[Hoje às] HH:mm",
	nextDay: "[Amanhã às] HH:mm",
	nextWeek: "dddd [às] HH:mm",
	lastDay: "[Ontem às] HH:mm",
	lastWeek: "[Última] dddd [às] HH:mm",
	sameElse: "DD/MM/YYYY [às] HH:mm",
};

export function formatCalendarDateTime(value: string | null) {
	if (!value) {
		return "";
	}

	const date = dayjs(value);

	if (!date.isValid()) {
		return "";
	}

	return date.calendar(null, calendarFormats);
}

export function formatDate(value: string | null) {
	if (!value) {
		return "";
	}

	const date = dayjs(value);
	return date.isValid() ? date.format("DD/MM/YYYY") : "";
}
