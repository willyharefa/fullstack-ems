export const TIME_ZONE = process.env.TIME_ZONE || "Asia/Jakarta";

const getTimeZoneOffsetMs = (timeZone, date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(date);

    const values = {};

    for (const part of parts) {
        if ( part.type !== "literal" ) values[part.type] = part.value;
    }

    const asUTC = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour) % 24,
        Number(values.minute),
        Number(values.second)
    );

    return asUTC - date.getTime();
}

const getLocalDateParts = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(date);

    const values = {};

    for (const part of parts) {
        if ( part.type !== "literal" ) values[part.type] = part.value;
    }

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
        hour: Number(values.hour) % 24,
        minute: Number(values.minute),
        second: Number(values.second),
    };
};

export const getTodayDateString = (date = new Date()) => {
    const { year, month, day } = getLocalDateParts(date);
    const pad = (n) => String(n).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)}`;
}

export const getTodayDayRange = (date = new Date()) => {
    const { year, month, day } = getLocalDateParts(date);
    const offsetMs = getTimeZoneOffsetMs(TIME_ZONE, date);

    const start = new Date( Date.UTC(year, month - 1, day) - offsetMs );
    const end   = new Date( start.getTime() + 24 * 60 * 60 * 1000 );

    return { start, end };
}

export const getMonthRange = (date = new Date()) => {
    const { year, month } = getLocalDateParts(date);
    const offsetMs = getTimeZoneOffsetMs(TIME_ZONE, date);

    const start = new Date( Date.UTC(year, month - 1, 1) - offsetMs )
    const end   = new Date( Date.UTC(year, month, 1) - offsetMs );

    return { start, end };
}

export const getLocalHourMinute = (date = new Date()) => {
    const { hour, minute } = getLocalDateParts(date);
    return { hour, minute };
}