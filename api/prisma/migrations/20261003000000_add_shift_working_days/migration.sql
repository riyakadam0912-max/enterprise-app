ALTER TABLE "Shift"
ADD COLUMN "workingDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];

UPDATE "Shift"
SET "workingDays" = ARRAY(
  SELECT day
  FROM generate_series(0, 6) AS weekdays(day)
  WHERE day <> "Shift"."weeklyHolidayDay"
  ORDER BY day
);
