import { TimeEntry, Employee } from './firestore';
import { format, isSameDay } from 'date-fns';

export interface ProcessedTimeEntry extends TimeEntry {
    originalEntryId: string;
    calculatedWorkType: 'regular' | 'overtime' | 'double_time' | 'travel';
    calculatedHours: number;
    calculatedPay: number;
}

export interface PayrollSummary {
    employee: Employee;
    regularHours: number;
    overtimeHours: number;
    doubleTimeHours: number;
    totalHours: number;
    regularPay: number;
    overtimePay: number;
    doubleTimePay: number;
    grossPay: number;
    status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed' | 'mixed';
    originalEntries: TimeEntry[];
    processedEntries: ProcessedTimeEntry[]; // For line-item exports
}

export interface OTRules {
    dailyOvertimeThreshold?: number;
    weeklyOvertimeThreshold?: number;
    dailyDoubleTimeThreshold?: number;
    overtimeMultiplier?: number;
    doubleTimeMultiplier?: number;
}

/**
 * Calculates correct payroll allocations and line-item breakdowns for an employee based on standard overtime rules.
 */
export function calculatePayrollSummary(
    entries: TimeEntry[],
    employee: Employee,
    otRules: OTRules | undefined,
    payPeriodType: string | undefined
): PayrollSummary {
    const rate = employee.payRate || 0;
    const isSalaried = employee.payType === 'salary';

    // Default OT Rules
    const dailyOT = otRules?.dailyOvertimeThreshold ?? 8;
    const weeklyOT = otRules?.weeklyOvertimeThreshold ?? 40;
    const dailyDT = otRules?.dailyDoubleTimeThreshold ?? 12;
    const otMult = otRules?.overtimeMultiplier ?? 1.5;
    const dtMult = otRules?.doubleTimeMultiplier ?? 2.0;

    // Sorting entries chronologically is critical for rolling weekly OT accumulation
    const sortedEntries = [...entries].sort((a, b) => a.date.toMillis() - b.date.toMillis());

    let regularHours = 0;
    let overtimeHours = 0;
    let doubleTimeHours = 0;
    let totalHours = 0;
    const processedEntries: ProcessedTimeEntry[] = [];

    if (isSalaried) {
        // Salaried bypasses OT rules
        regularHours = sortedEntries.reduce((sum, e) => sum + e.totalHours, 0);
        totalHours = regularHours;

        sortedEntries.forEach(e => {
            processedEntries.push({
                ...e,
                originalEntryId: e.id,
                calculatedWorkType: 'regular',
                calculatedHours: e.totalHours,
                calculatedPay: 0, // Salary pay is calculated at the end
            });
        });

    } else {
        // Hourly logic - track daily and weekly accumulation
        let weeklyAccumulatedRegular = 0;

        // Group entries by day to handle daily thresholds
        const entriesByDay: Record<string, TimeEntry[]> = {};
        sortedEntries.forEach(e => {
            const key = format(e.date.toDate(), 'yyyy-MM-dd');
            if (!entriesByDay[key]) entriesByDay[key] = [];
            entriesByDay[key].push(e);
        });

        Object.values(entriesByDay).forEach(dayEntries => {
            let dayTotalHours = 0;

            dayEntries.forEach(entry => {
                // If it's pure travel, maybe we don't apply OT strictly, but standard compliance usually counts travel in the week.
                // Assuming travel counts towards hours for simplify here, unless specified otherwise.
                // If needed, we can exclude Travel from OT buckets later.
                if (entry.workType === 'travel') {
                    // Usually travel is straight time, but check local rules. Safe to treat as regular for now but keep label.
                    processedEntries.push({
                        ...entry,
                        originalEntryId: entry.id,
                        calculatedWorkType: 'travel',
                        calculatedHours: entry.totalHours,
                        calculatedPay: entry.totalHours * rate
                    });
                    totalHours += entry.totalHours;
                    // Depending on rules, travel might not count to OT. We'll skip adding to dayTotalHours for OT calcs here if it's strictly distinct.
                    return;
                }

                const hours = entry.totalHours;
                totalHours += hours;

                // We need to split this specific entry if it crosses a threshold
                let entryReg = 0;
                let entryOT = 0;
                let entryDT = 0;

                // How many hours already worked today BEFORE this entry?
                const priorDaily = dayTotalHours;
                const newDailyTotal = priorDaily + hours;

                // 1. Calculate Daily Buckets for THIS entry
                if (newDailyTotal <= dailyOT) {
                    entryReg = hours;
                } else if (priorDaily >= dailyDT) {
                    entryDT = hours;
                } else if (newDailyTotal > dailyDT) {
                    // Crosses into DT
                    if (priorDaily < dailyOT) {
                        // Started in Reg, went through OT, ended in DT (Huge shift)
                        entryReg = dailyOT - priorDaily;
                        entryOT = dailyDT - dailyOT;
                        entryDT = newDailyTotal - dailyDT;
                    } else {
                        // Started in OT, ended in DT
                        entryOT = dailyDT - priorDaily;
                        entryDT = newDailyTotal - dailyDT;
                    }
                } else {
                    // Crosses into OT but not DT
                    if (priorDaily < dailyOT) {
                        entryReg = dailyOT - priorDaily;
                        entryOT = newDailyTotal - dailyOT;
                    } else {
                        entryOT = hours;
                    }
                }

                // 2. Adjust Reg to OT if Weekly Threshold crossed
                if (entryReg > 0) {
                    const priorWeekly = weeklyAccumulatedRegular;
                    const newWeekly = priorWeekly + entryReg;

                    if (newWeekly > weeklyOT) {
                        if (priorWeekly < weeklyOT) {
                            // Crosses weekly threshold this entry
                            const shiftedToOT = newWeekly - weeklyOT;
                            entryReg -= shiftedToOT;
                            entryOT += shiftedToOT;
                        } else {
                            // Already past weekly threshold
                            entryOT += entryReg;
                            entryReg = 0;
                        }
                    }
                    weeklyAccumulatedRegular += entryReg;
                }

                // Add to global totals
                regularHours += entryReg;
                overtimeHours += entryOT;
                doubleTimeHours += entryDT;
                dayTotalHours += hours;

                // Create line items for the export/detail view
                if (entryReg > 0) {
                    processedEntries.push({
                        ...entry,
                        originalEntryId: entry.id,
                        calculatedWorkType: 'regular',
                        calculatedHours: entryReg,
                        calculatedPay: entryReg * rate
                    });
                }
                if (entryOT > 0) {
                    processedEntries.push({
                        ...entry,
                        originalEntryId: entry.id,
                        calculatedWorkType: 'overtime',
                        calculatedHours: entryOT,
                        calculatedPay: entryOT * rate * otMult
                    });
                }
                if (entryDT > 0) {
                    processedEntries.push({
                        ...entry,
                        originalEntryId: entry.id,
                        calculatedWorkType: 'double_time',
                        calculatedHours: entryDT,
                        calculatedPay: entryDT * rate * dtMult
                    });
                }
            });
        });
    }

    // Calculate overall pay
    let regularPay = 0;
    let overtimePay = 0;
    let doubleTimePay = 0;
    let grossPay = 0;

    if (isSalaried) {
        // Salary: annual rate / periods. Safe fallback to weekly if unknown.
        const periodsPerYear = payPeriodType === 'weekly' ? 52 : payPeriodType === 'bi-weekly' ? 26 : payPeriodType === 'semi-monthly' ? 24 : 12;
        regularPay = rate / periodsPerYear;
        grossPay = regularPay;

        // Update the processed entries with the prorated pay for displays if we wanted to
        const payPerEntry = sortedEntries.length > 0 ? (grossPay / sortedEntries.length) : 0;
        processedEntries.forEach(pe => pe.calculatedPay = payPerEntry);
    } else {
        regularPay = regularHours * rate;
        overtimePay = overtimeHours * rate * otMult;
        doubleTimePay = doubleTimeHours * rate * dtMult;

        // Add travel pay
        const travelPay = processedEntries.filter(p => p.calculatedWorkType === 'travel').reduce((sum, p) => sum + p.calculatedPay, 0);

        grossPay = regularPay + overtimePay + doubleTimePay + travelPay;
    }

    // Determine aggregated status
    const statuses = entries.map(e => e.status);
    let status: PayrollSummary['status'] = 'draft';
    if (entries.length === 0) status = 'draft';
    else if (statuses.every(s => s === 'processed')) status = 'processed';
    else if (statuses.every(s => s === 'approved' || s === 'processed')) status = 'approved';
    else if (statuses.every(s => s === 'rejected')) status = 'rejected';
    else if (statuses.some(s => s === 'rejected') && statuses.some(s => s !== 'rejected')) status = 'mixed';
    else if (statuses.some(s => s === 'submitted')) status = 'submitted';
    else status = 'draft';

    return {
        employee,
        regularHours,
        overtimeHours,
        doubleTimeHours,
        totalHours,
        regularPay,
        overtimePay,
        doubleTimePay,
        grossPay,
        status,
        originalEntries: entries,
        processedEntries
    };
}
