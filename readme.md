
### System Overview
This system is a hybrid enterprise resource planning (ERP) platform designed to support both **Retail Business Operations** and **NGO Fund Accounting**. It enables an organization to run a standard commercial operation (sales, inventory, invoices, and standard accounting) alongside program-specific non-profit tracks (donations, sponsorships, child support programs, and restricted funds) under a unified General Ledger.

---

### System Modules

#### 1. Core Dashboards
*   **Main Dashboard ([Dashboard.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/Dashboard.tsx)):** A unified interface displaying high-level stats, daily retail sales trends, donor/donation trends, inventory alerts, and a consolidated feed of recent activity across the platform.
*   **Accounting Dashboard ([AccountingDashboard.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/accounting/AccountingDashboard.tsx)):** Focuses strictly on standard financial positions: total assets, total liabilities, total equity, and monthly operating revenues, with shortcuts to ledger activities.
*   **Fund Accounting Dashboard ([FundDashboard.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/fund-accounting/FundDashboard.tsx)):** Serves as the command center for NGO tracking. It displays restricted/unrestricted balances and donation trends, and features a portal to quickly record donations with specific sponsorship/program dimensions.

#### 2. Point of Sale (POS) & Invoicing
*   **Point of Sale ([PointOfSale.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/PointOfSale.tsx)):** A product-focused interface that supports both standard commercial sales (**Retail Mode**) and sponsor-directed transactions (**NGO Mode**). It processes multi-method payments (Cash, Card, M-Pesa, or Invoice/Credit). In NGO Mode, transactions are tagged with donor, child, and fund account parameters.
*   **Invoicing ([Invoice.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/Invoice.tsx)):** Manages invoice rendering, printing, and sharing. It handles partial or full manual payments and integrates a simulated M-Pesa STK Push sequence to automate customer billing.
*   **Sales Reports ([SalesReports.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/SalesReports.tsx)):** Provides filters by date ranges, breaks down sales metrics (Count, Revenue, Average Order Value), calculates payment method distributions (Cash vs. Card vs. M-Pesa), and exports transaction listings to CSV.

#### 3. Operations & Supply Chain
*   **Inventory ([Inventory.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/Inventory.tsx)):** Manages stock counts, category trees, unit configurations, buying/selling prices, and triggers warning alerts when stock levels fall below specified thresholds.
*   **Customers ([Customers.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/Customers.tsx)):** Houses the customer directory, tracks total historical purchases, lists current outstanding balances, and manages profile data.
*   **Suppliers ([Suppliers.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/Suppliers.tsx)):** Coordinates supplier details, purchase orders, purchase balances, and procurement histories.

#### 4. Expenditure & Approvals
*   **Expenses ([Expenses.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/Expenses.tsx)):** Tracks standard operating expenditures (rent, utilities) and project/program expenses. All expenses are mapped to a Chart of Accounts code and can be dimensionally tracked against a cost-center Department, Fund Account, Child Sponsor, or Donor. It includes an approval system; transactions only affect cash/bank balances once approved by an administrator.

#### 5. Payroll & Employees
*   **Employee Profiles ([Employees.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/Employees.tsx)):** Manages employee details, positions, bank accounts, and statutory ID numbers (Tax PIN, NSSF, NHIF/SHA).
*   **Payroll Processing:** Enables payroll generation across custom periods. It automatically computes gross pay, deductions (PAYE, NSSF, NHIF/SHIF, Housing Levy), and net salaries. Upon confirmation, it posts a consolidated journal entry to the General Ledger.

#### 6. NGO & Fund Tracking
*   **Child Support ([ChildManagement.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/fund-accounting/ChildManagement.tsx)):** Tracks enrolled children in sponsorship programs, matches them with guardians, auto-generates sponsorship tracking codes, and links them to donors.
*   **Donations ([Donations.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/fund-accounting/Donations.tsx)):** Coordinates donor profiles and records donations. These donations can be unrestricted or restricted to specific funds or individual child support profiles.
*   **Departments & Funds Setup ([DepartmentsAndFunds.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/fund-accounting/DepartmentsAndFunds.tsx)):** Registers administrative cost centers (**Departments**) and program-specific buckets (**Fund Accounts**), specifying whether funds are *unrestricted*, *temporarily restricted*, or *permanently restricted*.
*   **Internal Transfers ([InternalTransfers.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/fund-accounting/InternalTransfers.tsx)):** Governs transfers of funds between departments. These transfers require administrative approval before updating the General Ledger.
*   **NGO Billing ([NGOBilling.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/fund-accounting/NGOBilling.tsx)):** Manages billing for school fees and child sponsorships, linking invoice items directly to specific funds, departments, and sponsored children.

#### 7. General Ledger & Financial Reporting
*   **Accounting Framework ([ChartOfAccounts.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/accounting/ChartOfAccounts.tsx)):** Houses the double-entry accounting tools. Generates real-time financial statements, including the **General Ledger**, **Balance Sheet**, **Trial Balance**, **Income Statement**, and **Cash Flow Statement**. It also includes a **Bank Reconciliation** module for matching bank statements against internal transactions.

#### 8. Administration & Access
*   **User Management ([UserManagement.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/UserManagement.tsx)):** Manages system credentials and implements Role-Based Access Control (RBAC). Admins can toggle system-wide permissions (e.g., POS access, payroll administration, expense approvals) across different custom user roles.
*   **Settings ([Settings.tsx](file:///c:/Users/CYBER%201/Desktop/chdf/src/pages/Settings.tsx)):** Configures currency, tax (VAT) rates, M-Pesa integration keys, and custom ID prefix sequences (e.g., invoice prefixes, member ID codes).

---

### Chart of Accounts (COA) Map
The General Ledger relies on a standardized, double-entry numbering system. Below are the pre-seeded accounts categorized by type:

#### 1. Assets (1000 Series)
Used to track what the organization owns, divided into liquid cash accounts, receivables, inventory, and restricted NGO capital.
*   `1000` - **Assets** *(System Parent)*
*   `1100` - **Current Assets** *(System Parent)*
*   `1110` - **Cash**
*   `1111` - **Bank / Mpesa** *(Also referenced as Bank - Mpesa/Card)*
*   `1120` - **Accounts Receivable**
*   `1130` - **Inventory**
*   `1150` - **Restricted Fund Cash** *(NGO restricted donations)*
*   `1160` - **Temporarily Restricted Assets** *(NGO temporary assets)*
*   `1170` - **Permanently Restricted Assets** *(NGO endowment assets)*
*   `1200` - **Fixed Assets**

#### 2. Liabilities (2000 Series)
Used to track what the organization owes, including vendor balances, tax liabilities, and payroll obligations.
*   `2000` - **Liabilities** *(System Parent)*
*   `2100` - **Current Liabilities** *(System Parent)*
*   `2110` - **Accounts Payable**
*   `2120` - **Accrued Expenses**
*   `2121` - **PAYE Payable** *(Statutory payroll tax)*
*   `2122` - **NSSF Payable** *(Statutory pension deduction)*
*   `2123` - **NHIF/SHIF Payable** *(Statutory health insurance deduction)*
*   `2124` - **Housing Levy Payable** *(Statutory housing levy)*
*   `2125` - **Net Salary Payable** *(Accrued payroll salaries)*
*   `2150` - **Sales Tax Payable** *(VAT collections)*

#### 3. Equity (3000 Series)
Used to track retained earnings and the net assets of the organization (categorized by restriction level for NGO audits).
*   `3000` - **Equity** *(System Parent)*
*   `3100` - **Owner's Equity**
*   `3200` - **Unrestricted Net Assets**
*   `3210` - **Temporarily Restricted Net Assets**
*   `3220` - **Permanently Restricted Net Assets**

#### 4. Revenue (4000 Series)
Used to track sales income and donor contributions.
*   `4000` - **Revenue** *(System Parent)*
*   `4100` - **Sales Revenue** *(Retail sales)*
*   `4200` - **Donation Revenue** *(Total donations)*
*   `4210` - **Unrestricted Donations**
*   `4220` - **Temporarily Restricted Donations**
*   `4230` - **Permanently Restricted Donations**
*   `4240` - **Child Sponsorship Revenue**
*   `4250` - **Grant Revenue**
*   `4260` - **In-Kind Donations**

#### 5. Expenses (5000 Series)
Used to track day-to-day operations, payroll, and program delivery costs.
*   `5000` - **Expenses** *(System Parent)*
*   `5100` - **Cost of Goods Sold** *(COGS)*
*   `5200` - **Operating Expenses** *(General overhead)*
*   `5210` - **Payroll / Salary Expense** *(Gross employee wages)*
*   `5300` - **Program Expenses** *(General NGO project expenses)*
*   `5310` - **Education Program Expenses** *(School support/fees)*
*   `5320` - **Health & Medical Program Expenses** *(Clinic/medical aid)*
*   `5330` - **Feeding Program Expenses** *(Food programs)*
*   `5340` - **Social Welfare Expenses** *(Community outreach)*
*   `5350` - **Child Sponsorship Disbursements** *(Direct sponsorship distributions)*
*   `5360` - **Fundraising Expenses**
*   `5370` - **Administrative Overhead (NGO)** *(Non-profit administrative overhead)*