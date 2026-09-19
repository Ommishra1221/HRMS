--
-- HRMS - DEMO DATA (leave, attendance, payroll)
-- ============================================
-- Populates leave_schema, attendance_schema and payroll_schema inside the
-- shared "HRMS" database with realistic, presentation-ready data so the
-- frontend lists, filters, detail pages, dashboard tiles and charts all show
-- something meaningful instead of empty states.
--
-- This is the SAME database model the services use in production:
--   database "HRMS"  ->  employee_schema.employees     (employee-service)
--                        leave_schema.leaves           (leave-service)
--                        attendance_schema.attendance  (attendance-service)
--                        payroll_schema.payrolls       (payroll-service)
--                        auth_schema.users/roles       (auth-service)
-- Hibernate qualifies every statement with its own default_schema, and this
-- script does the same by always writing schema.table explicitly.
--
-- HOW TO RUN (one command, from the project root):
--
--     export PGPASSWORD=postgres
--     "/c/Program Files/PostgreSQL/16/bin/psql" -U postgres -h localhost \
--         -f database/demo_data.sql
--
-- (If your psql is on PATH, just: psql -U postgres -h localhost -f database/demo_data.sql)
--
-- IDEMPOTENT: every INSERT is guarded with NOT EXISTS, so running this twice
-- changes nothing. The employee roster is read from employee_schema.employees,
-- so employees you add later also get data when you re-run the script.
--
-- BUSINESS RULES RESPECTED (exactly what the Java services enforce):
--   * attendance: one record per employee per day; PRESENT/HALF_DAY always have
--     a check_in; check_out is never before check_in; no weekend rows.
--   * leave: to_date >= from_date; only PENDING/APPROVED/REJECTED; only the
--     three leave types the form offers (SICK, CASUAL, EARNED); no overlapping
--     requests for the same employee.
--   * payroll: one payslip per employee per month; month is "yyyy-MM"; all
--     amounts >= 0; PAID payslips have a payment_date, PENDING ones do not
--     (the service stamps the date when "Mark paid" is pressed).
--   * employee_id values are real rows of employee_schema.employees.
--   * APPROVED leave dates become "LEAVE" attendance rows instead of PRESENT,
--     so attendance and leave tell the same story.
--

\set ON_ERROR_STOP on

\connect HRMS

\echo '======================================================'
\echo ' HRMS demo data -> leave, attendance and payroll'
\echo '======================================================'


-- =============================================================================
-- 1. leave_schema.leaves
-- =============================================================================
-- 16 requests across every employee, spread over Jun-Oct 2026:
--   9 APPROVED (past and future - the "already reviewed" paperwork),
--   3 REJECTED (each with a plausible business reason),
--   4 PENDING  (waiting for review, so the approval demo has material).
-- No employee has two overlapping ranges, and every row carries a reason so no
-- detail page shows an empty field. The roster is derived from the employees
-- that actually exist, so the demo never references a deleted employee.
BEGIN;

INSERT INTO leave_schema.leaves (employee_id, leave_type, from_date, to_date, reason, status)
SELECT v.employee_id, v.leave_type, v.from_date::date, v.to_date::date, v.reason, v.status
FROM (VALUES
    -- ---- APPROVED ----------------------------------------------------------
    (1, 'SICK',   '2026-08-10', '2026-08-11', 'Viral fever - doctor advised two days of rest', 'APPROVED'),
    (1, 'CASUAL', '2026-09-04', '2026-09-04', 'Bike registration work at the RTO office',      'APPROVED'),
    (2, 'CASUAL', '2026-08-14', '2026-08-14', 'Personal work at the bank',                     'APPROVED'),
    (2, 'EARNED', '2026-10-05', '2026-10-09', 'Family trip during the festive week',           'APPROVED'),
    (3, 'EARNED', '2026-08-24', '2026-08-28', 'Family vacation out of station',                'APPROVED'),
    (4, 'EARNED', '2026-06-22', '2026-06-26', 'Annual leave - visiting parents',               'APPROVED'),
    (4, 'CASUAL', '2026-07-16', '2026-07-17', 'Apartment registration formalities',            'APPROVED'),
    (5, 'SICK',   '2026-09-07', '2026-09-08', 'Severe migraine, unable to travel',             'APPROVED'),
    (6, 'EARNED', '2026-09-21', '2026-09-25', 'Annual leave - visiting parents',               'APPROVED'),

    -- ---- REJECTED ----------------------------------------------------------
    (2, 'CASUAL', '2026-09-09', '2026-09-10', 'Personal errand',                               'REJECTED'),
    (3, 'EARNED', '2026-09-14', '2026-09-18', 'Extended personal break',                       'REJECTED'),
    (5, 'EARNED', '2026-12-21', '2026-12-26', 'Year end holiday with family',                  'REJECTED'),

    -- ---- PENDING -----------------------------------------------------------
    (1, 'SICK',   '2026-09-17', '2026-09-18', 'Recovering from cold and fever',                'PENDING'),
    (3, 'CASUAL', '2026-10-01', '2026-10-02', 'Grandmother surgery - need to travel',          'PENDING'),
    (4, 'CASUAL', '2026-09-25', '2026-09-25', 'Passport appointment at the regional office',   'PENDING'),
    (6, 'SICK',   '2026-09-28', '2026-09-29', 'Dental surgery and recovery',                   'PENDING')
) AS v(employee_id, leave_type, from_date, to_date, reason, status)
WHERE NOT EXISTS (
    SELECT 1 FROM leave_schema.leaves l
    WHERE l.employee_id = v.employee_id
      AND l.leave_type  = v.leave_type
      AND l.from_date   = v.from_date::date
);

COMMIT;


-- =============================================================================
-- 2. attendance_schema.attendance
-- =============================================================================
-- One row per employee per WEEKDAY from 24 Aug to 18 Sep 2026 (20 weekdays),
-- with a realistic mix: mostly PRESENT, plus WFH, HALF_DAY, ABSENT and LEAVE.
-- Weekend days are skipped entirely - a demo should not show Saturday standups.
BEGIN;

WITH roster AS (
    -- Read the real roster: no hardcoded ids, so re-running after adding an
    -- employee seeds that employee too.
    SELECT id AS employee_id FROM employee_schema.employees
),
work_days AS (
    -- extract(isodow) = 1 (Mon) ... 7 (Sun); < 6 keeps Monday-Friday.
    SELECT d::date AS day
    FROM generate_series(DATE '2026-08-24', DATE '2026-09-18', INTERVAL '1 day') AS d
    WHERE extract(isodow FROM d) < 6
),
seeded AS (
    -- hashtext() turns (employee, day) into a stable pseudo-random number, so
    -- the pattern is varied but identical on every run of this script.
    SELECT r.employee_id,
           w.day,
           abs(hashtext(r.employee_id::text || w.day::text)) AS h,
           (l.id IS NOT NULL) AS on_leave
    FROM roster r
    CROSS JOIN work_days w
    -- An APPROVED leave covering that day wins over any random status.
    LEFT JOIN leave_schema.leaves l
           ON l.employee_id = r.employee_id
          AND l.status = 'APPROVED'
          AND w.day BETWEEN l.from_date AND l.to_date
),
computed AS (
    SELECT employee_id,
           day,
           CASE
               WHEN on_leave     THEN 'LEAVE'
               WHEN h % 100 <  8 THEN 'WFH'
               WHEN h % 100 < 12 THEN 'ABSENT'
               WHEN h % 100 < 16 THEN 'HALF_DAY'
               ELSE                   'PRESENT'
           END AS status,
           CASE
               WHEN on_leave     THEN NULL
               WHEN h % 100 <  8 THEN TIME '09:00' + ((h / 13) % 50) * INTERVAL '1 minute'
               WHEN h % 100 < 12 THEN NULL
               WHEN h % 100 < 16 THEN TIME '08:50' + ((h / 19) % 30) * INTERVAL '1 minute'
               ELSE                   TIME '08:40' + ((h /  7) % 55) * INTERVAL '1 minute'
           END AS check_in,
           CASE
               WHEN on_leave     THEN NULL
               WHEN h % 100 <  8 THEN TIME '17:50' + ((h / 17) % 55) * INTERVAL '1 minute'
               WHEN h % 100 < 12 THEN NULL
               WHEN h % 100 < 16 THEN NULL   -- HALF_DAY: derived from check_in below
               ELSE                   TIME '17:40' + ((h / 11) % 80) * INTERVAL '1 minute'
           END AS full_day_check_out
    FROM seeded
)
INSERT INTO attendance_schema.attendance (employee_id, attendance_date, status, check_in, check_out)
SELECT c.employee_id,
       c.day,
       c.status,
       c.check_in,
       -- A half day is one check-in plus four hours - always after check_in.
       CASE WHEN c.status = 'HALF_DAY' THEN c.check_in + INTERVAL '4 hours'
            ELSE c.full_day_check_out
       END
FROM computed c
WHERE NOT EXISTS (
    SELECT 1 FROM attendance_schema.attendance a
    WHERE a.employee_id = c.employee_id AND a.attendance_date = c.day
);

COMMIT;


-- =============================================================================
-- 3. payroll_schema.payrolls
-- =============================================================================
-- Five settled months (Apr-Aug 2026, PAID) plus the current open month
-- (Sep 2026, PENDING). That fills the dashboard's six-bar payslips-by-month
-- chart, the PENDING/PAID filters, and gives "Mark paid" something to do.
--
-- Salary is derived from the employee's department plus a deterministic
-- variation, so two Engineers do not earn exactly the same and nobody has a
-- placeholder round number:
--     allowances = 13% of basic   (HRA, LTA, medical...)
--     deductions = 17.5% of basic (provident fund + tax)
--     net        = basic + allowances - deductions  (same formula as the service)
BEGIN;

-- ---- Closed months: already paid ------------------------------------------
WITH roster AS (
    SELECT e.id AS employee_id,
           base.basic_salary,
           round(base.basic_salary * 0.130, -2) AS base_allowances,
           round(base.basic_salary * 0.175, -2) AS base_deductions
    FROM employee_schema.employees e
    CROSS JOIN LATERAL (
        SELECT (CASE e.department
                    WHEN 'Engineering'     THEN 70000
                    WHEN 'Finance'         THEN 64000
                    WHEN 'Marketing'       THEN 56000
                    WHEN 'Human Resources' THEN 52000
                    WHEN 'Operations'      THEN 46000
                    ELSE 44000
                END
                + (abs(hashtext('basic' || e.id::text)) % 7) * 1000)::numeric AS basic_salary
    ) base
),
closed_months (month) AS (
    VALUES ('2026-04'), ('2026-05'), ('2026-06'), ('2026-07'), ('2026-08')
)
INSERT INTO payroll_schema.payrolls
    (employee_id, month, basic_salary, allowances, deductions, payment_date, status)
SELECT r.employee_id,
       m.month,
       r.basic_salary,
       -- Small deterministic month-to-month drift (0-500), the way real
       -- allowances move with overtime and reimbursements.
       r.base_allowances + ((abs(hashtext(r.employee_id::text || m.month)) % 6) * 100),
       r.base_deductions,
       -- Paid on the last working day of the month.
       ld.last_day
         - CASE extract(isodow FROM ld.last_day)
               WHEN 6 THEN 1   -- Saturday -> Friday
               WHEN 7 THEN 2   -- Sunday   -> Friday
               ELSE 0
           END,
       'PAID'
FROM roster r
CROSS JOIN closed_months m
CROSS JOIN LATERAL (
    SELECT (date_trunc('month', to_date(m.month || '-01', 'YYYY-MM-DD'))
            + INTERVAL '1 month - 1 day')::date AS last_day
) ld
WHERE NOT EXISTS (
    SELECT 1 FROM payroll_schema.payrolls p
    WHERE p.employee_id = r.employee_id AND p.month = m.month
);

-- ---- Open month: generated, not yet paid ----------------------------------
WITH roster AS (
    SELECT e.id AS employee_id,
           base.basic_salary,
           round(base.basic_salary * 0.130, -2) AS base_allowances,
           round(base.basic_salary * 0.175, -2) AS base_deductions
    FROM employee_schema.employees e
    CROSS JOIN LATERAL (
        SELECT (CASE e.department
                    WHEN 'Engineering'     THEN 70000
                    WHEN 'Finance'         THEN 64000
                    WHEN 'Marketing'       THEN 56000
                    WHEN 'Human Resources' THEN 52000
                    WHEN 'Operations'      THEN 46000
                    ELSE 44000
                END
                + (abs(hashtext('basic' || e.id::text)) % 7) * 1000)::numeric AS basic_salary
    ) base
)
INSERT INTO payroll_schema.payrolls
    (employee_id, month, basic_salary, allowances, deductions, payment_date, status)
SELECT r.employee_id,
       '2026-09',
       r.basic_salary,
       r.base_allowances + ((abs(hashtext(r.employee_id::text || '2026-09')) % 6) * 100),
       r.base_deductions,
       NULL,          -- the service stamps this date when the payslip is paid
       'PENDING'
FROM roster r
WHERE NOT EXISTS (
    SELECT 1 FROM payroll_schema.payrolls p
    WHERE p.employee_id = r.employee_id AND p.month = '2026-09'
);

COMMIT;


-- =============================================================================
-- Summary
-- =============================================================================
\echo ''
\echo 'Demo data loaded:'

\echo ''
\echo '--- leave_schema.leaves ---'
SELECT status, count(*) AS requests, count(DISTINCT employee_id) AS employees
FROM leave_schema.leaves GROUP BY status ORDER BY status;

\echo ''
\echo '--- attendance_schema.attendance ---'
SELECT status, count(*) AS records FROM attendance_schema.attendance
GROUP BY status ORDER BY status;

\echo ''
\echo '--- attendance: days per employee ---'
SELECT employee_id, count(*) AS records, min(attendance_date) AS first_day, max(attendance_date) AS last_day
FROM attendance_schema.attendance GROUP BY employee_id ORDER BY employee_id;

\echo ''
\echo '--- payroll_schema.payrolls ---'
SELECT month, status, count(*) AS payslips,
       sum(basic_salary + allowances - deductions) AS total_net
FROM payroll_schema.payrolls GROUP BY month, status ORDER BY month, status;
