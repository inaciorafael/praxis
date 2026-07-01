import dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
import "dayjs/locale/pt-br";
import "dayjs/locale/en";
import { i18n } from "@/shared/lib/i18n/i18n";

dayjs.extend(calendar);
function activeLocale() {
	return i18n.global.locale.value === "pt-BR" ? "pt-br" : "en";
}

export function formatCalendarDateTime(value: string | null) {
	if (!value) {
		return "";
	}

	const date = dayjs(value);

	if (!date.isValid()) {
		return "";
	}

	dayjs.locale(activeLocale());
	const formats =
		activeLocale() === "pt-br"
			? {
					sameDay: "[Hoje às] HH:mm",
					nextDay: "[Amanhã às] HH:mm",
					nextWeek: "dddd [às] HH:mm",
					lastDay: "[Ontem às] HH:mm",
					lastWeek: "[Última] dddd [às] HH:mm",
					sameElse: "DD/MM/YYYY [às] HH:mm",
				}
			: {
					sameDay: "[Today at] h:mm A",
					nextDay: "[Tomorrow at] h:mm A",
					nextWeek: "dddd [at] h:mm A",
					lastDay: "[Yesterday at] h:mm A",
					lastWeek: "[Last] dddd [at] h:mm A",
					sameElse: "MM/DD/YYYY [at] h:mm A",
				};

	return date.calendar(null, formats);
}

export function formatDate(value: string | null) {
	if (!value) {
		return "";
	}

	const date = dayjs(value);
	return date.isValid()
		? new Intl.DateTimeFormat(i18n.global.locale.value).format(date.toDate())
		: "";
}

export function formatLongDate(value: Date | string) {
	return new Intl.DateTimeFormat(i18n.global.locale.value, {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "2-digit",
	}).format(new Date(value));
}
