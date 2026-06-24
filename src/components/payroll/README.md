# Payroll System

A comprehensive payroll management system integrated with the accounting module for the TAM business management application.

## Features

### Core Payroll Functionality
- **Employee Payroll Management**: Store and manage employee salary information, bank details, and tax information
- **Payroll Periods**: Create and manage payroll periods (weekly, bi-weekly, monthly)
- **Payroll Calculations**: Automatic calculation of gross pay, deductions, and net pay
- **Payroll Runs**: Generate and process payroll for all employees in a period
- **Approval Workflow**: Draft → Approved → Paid workflow for payroll processing

### Payroll Settings
- **Pay Periods**: Configure weekly, bi-weekly, or monthly pay schedules
- **Rates**: Set overtime rates, holiday pay rates, and deduction percentages
- **Tax Deductions**: Configure tax, NHIF, and NSSF deduction rates
- **Payment Methods**: Support for bank transfer, M-Pesa, and cash payments

### Accounting Integration
- **Automatic Journal Entries**: Create accounting entries for payroll expenses and liabilities
- **Tax Liabilities**: Track tax, NHIF, and NSSF payables
- **Payment Processing**: Generate journal entries for payroll payments
- **Financial Reporting**: Integrate payroll data with financial statements

## Components

### PayrollSettingsModal
- Configure payroll settings and rates
- Set up deduction percentages
- Manage pay periods and payment methods

### PayrollPeriods
- Create and manage payroll periods
- View period status and totals
- Close periods when processing is complete

### PayrollRuns
- Display payroll runs for a period
- Approve and process payroll runs
- View individual employee payroll details

### PayrollDetailsModal
- Detailed view of payroll calculations
- Breakdown of earnings and deductions
- Print and download payroll information

### EmployeePayrollForm
- Manage employee payroll information
- Set basic salary and payment details
- Configure tax and insurance information

### PayrollDashboard
- Overview of payroll statistics
- Quick actions for payroll processing
- Status tracking and reporting

## Services

### PayrollService
- API integration for payroll operations
- Payroll calculations and processing
- Period and run management
- Accounting integration

### usePayroll Hook
- State management for payroll data
- Payroll operations and calculations
- Error handling and loading states

## Utilities

### PayrollAccountingUtils
- Create journal entries for payroll processing
- Handle payroll payments and tax payments
- Validate journal entry balances
- Calculate payroll summaries for reporting

## Database Schema

### Payroll Tables
- `payroll_settings`: Configuration for payroll rates and periods
- `payroll_periods`: Payroll periods with start/end dates and status
- `payroll_runs`: Individual employee payroll calculations
- `payroll_deductions`: Additional deductions for payroll runs
- `payroll_allowances`: Additional allowances for payroll runs
- `payroll_journal_entries`: Accounting entries for payroll
- `payroll_journal_lines`: Individual journal entry lines

### Employee Extensions
- `basic_salary`: Monthly basic salary (used for calculating payroll runs)
- `bank_name`: Bank name for payments (optional, relevant for bank transfer payment method)
- `bank_account`: Bank account number (optional, relevant for bank transfer payment method)
- `nhif_number`: NHIF/SHA membership number (**optional**; the form submits successfully without it and persists details to the DB)
- `nssf_number`: NSSF membership number (**optional**; the form submits successfully without it and persists details to the DB)
- `tax_pin`: Tax PIN number (**optional**, for tax computation records)
- `payment_method`: Payment method (bank, mpesa, cash)

## Usage

### Setting Up Payroll
1. Configure payroll settings with rates and deduction percentages
2. Add employee payroll information (salary, bank details, tax info)
3. Create payroll periods for processing

### Processing Payroll
1. Select a payroll period
2. Generate payroll runs for all employees
3. Review and approve payroll runs
4. Process payments and create accounting entries

### Accounting Integration
1. Payroll expenses are automatically recorded
2. Tax and insurance liabilities are tracked
3. Payment journal entries are created
4. Financial reports include payroll data

## API Endpoints

### Payroll Settings
- `GET /payroll-settings` - Get payroll settings
- `PUT /payroll-settings` - Update payroll settings

### Payroll Periods
- `GET /payroll-periods` - Get all periods
- `POST /payroll-periods` - Create new period
- `PUT /payroll-periods/:id` - Update period
- `PUT /payroll-periods/:id/close` - Close period

### Payroll Runs
- `GET /payroll-runs` - Get payroll runs
- `POST /payroll-runs` - Create payroll run
- `PUT /payroll-runs/:id` - Update payroll run
- `PUT /payroll-runs/:id/approve` - Approve payroll run
- `PUT /payroll-runs/:id/process` - Process payroll run

### Employee Payroll
- `PUT /employees/:id` - Update employee payroll information

## Future Enhancements

- **Time Tracking**: Integrate with time tracking for accurate overtime calculations
- **Leave Management**: Include leave balances and holiday pay calculations
- **Benefits Management**: Track employee benefits and contributions
- **Payroll Reports**: Generate detailed payroll reports and tax forms
- **Direct Deposit**: Integrate with banking APIs for direct deposits
- **Mobile App**: Employee self-service portal for payslips and tax documents 