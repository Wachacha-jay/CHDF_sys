# Backend Services Documentation

This directory contains all the backend services for the Business Management System. All services are built on top of Supabase and provide a clean, type-safe API for frontend components.

## Architecture Overview

The backend services follow a layered architecture:

1. **ApiService** - Base HTTP client with error handling
2. **Domain Services** - Business logic for each module
3. **Type Definitions** - TypeScript interfaces for all data structures

## Services Overview

### Core Services

#### ApiService (`api.ts`)
Base HTTP client that provides common CRUD operations and error handling.

```typescript
import { ApiService } from '../services';

// Get data with filters
const products = await ApiService.get<Product>('products', {
  filters: { is_active: true },
  orderBy: { column: 'name', ascending: true }
});

// Create new record
const newProduct = await ApiService.create<Product>('products', productData);

// Update record
const updatedProduct = await ApiService.update<Product>('products', id, updates);

// Delete record
const success = await ApiService.delete('products', id);
```

#### BusinessSettingsService (`businessSettingsService.ts`)
Manages business configuration and settings.

```typescript
import { BusinessSettingsService } from '../services';

// Get current settings
const settings = await BusinessSettingsService.getSettings();

// Update settings
const updated = await BusinessSettingsService.updateSettings(id, newSettings);

// Upload business logo
const logoUrl = await BusinessSettingsService.uploadLogo(file);
```

### Product & Inventory Management

#### ProductService (`productService.ts`)
Handles product catalog, categories, and inventory management.

```typescript
import { ProductService } from '../services';

// Get products with filters
const products = await ProductService.getProducts({
  category_id: 'category-id',
  search: 'search term'
});

// Create new product
const product = await ProductService.createProduct(productData);

// Update stock
const success = await ProductService.updateStock(productId, 10, 'in');

// Get low stock alerts
const lowStock = await ProductService.getLowStockProducts();
```

**Key Features:**
- Product CRUD operations
- Category management with hierarchical structure
- Inventory tracking with movements
- Stock alerts and statistics
- Image upload support

### Sales & Customer Management

#### SalesService (`salesService.ts`)
Manages sales transactions, payments, and customer relationships.

```typescript
import { SalesService } from '../services';

// Create a new sale
const sale = await SalesService.createSale({
  customer_id: 'customer-id',
  sale_date: '2024-01-15',
  items: [
    { product_id: 'product-id', quantity: 2, unit_price: 100 }
  ]
});

// Record payment
const success = await SalesService.recordPayment(saleId, 200);

// Get sales statistics
const stats = await SalesService.getSalesStats();
```

**Key Features:**
- Complete sales workflow
- Payment tracking
- Customer management
- Sales analytics
- Automatic inventory updates

### Accounting & Financial Management

#### AccountingService (`accountingService.ts`)
Handles double-entry bookkeeping, general ledger, and financial reports.

```typescript
import { AccountingService } from '../services';

// Create journal entry
const entry = await AccountingService.createJournalEntry({
  entry_date: '2024-01-15',
  description: 'Monthly rent payment',
  lines: [
    { account_id: 'rent-expense', debit_amount: 1000 },
    { account_id: 'cash', credit_amount: 1000 }
  ]
});

// Get balance sheet
const balanceSheet = await AccountingService.getBalanceSheet();

// Get trial balance
const trialBalance = await AccountingService.getTrialBalance();
```

**Key Features:**
- Double-entry bookkeeping
- Chart of accounts management
- Journal entries with validation
- Balance sheet and trial balance
- Financial reporting

### Employee & HR Management

#### EmployeeService (`employeeService.ts`)
Manages employee data, departments, and HR operations.

```typescript
import { EmployeeService } from '../services';

// Get employees by department
const employees = await EmployeeService.getEmployees({
  department: 'Sales'
});

// Create new employee
const employee = await EmployeeService.createEmployee(employeeData);

// Get employee statistics
const stats = await EmployeeService.getEmployeeStats();
```

**Key Features:**
- Employee CRUD operations
- Department and position management
- Salary tracking
- Employee statistics
- Validation and bulk operations

### Supplier & Purchase Management

#### SupplierService (`supplierService.ts`)
Handles supplier relationships and purchase operations.

```typescript
import { SupplierService } from '../services';

// Create purchase order
const purchase = await SupplierService.createPurchase({
  supplier_id: 'supplier-id',
  purchase_date: '2024-01-15',
  items: [
    { product_id: 'product-id', quantity: 50, unit_cost: 10 }
  ]
});

// Record supplier payment
const success = await SupplierService.recordPurchasePayment(purchaseId, 500);
```

**Key Features:**
- Supplier management
- Purchase order processing
- Payment tracking
- Inventory updates on purchases
- Supplier analytics

### Dashboard & Analytics

#### DashboardService (`dashboardService.ts`)
Provides comprehensive dashboard data and analytics.

```typescript
import { DashboardService } from '../services';

// Get dashboard statistics
const stats = await DashboardService.getDashboardStats();

// Get sales chart data
const chartData = await DashboardService.getSalesChartData(30);

// Get recent activity
const activities = await DashboardService.getRecentActivity(10);
```

**Key Features:**
- Real-time dashboard statistics
- Chart data for various metrics
- Recent activity feed
- Quick actions
- Multi-module data aggregation

### Expense Management

#### ExpenseService (`expenseService.ts`)
Handles expense tracking and approval workflows.

```typescript
import { ExpenseService } from '../services';

// Create expense
const expense = await ExpenseService.createExpense({
  account_id: 'office-supplies',
  expense_date: '2024-01-15',
  amount: 150,
  description: 'Office supplies purchase'
});

// Approve expense
const approved = await ExpenseService.approveExpense(expenseId, 'approver-id');
```

**Key Features:**
- Expense tracking
- Approval workflows
- Receipt upload
- Expense analytics
- Account categorization

## Data Flow

### Typical Request Flow
1. Frontend component calls service method
2. Service method uses ApiService to make HTTP request
3. ApiService handles authentication, error handling, and response formatting
4. Service method processes data and returns result
5. Frontend component receives typed data

### Error Handling
All services use consistent error handling through the ApiService:

```typescript
try {
  const result = await SomeService.someMethod();
  if (result) {
    // Success
  } else {
    // Handle error
  }
} catch (error) {
  // Handle unexpected errors
}
```

## Type Safety

All services are fully typed with TypeScript interfaces defined in `../types/index.ts`. This ensures:

- Compile-time error checking
- IntelliSense support
- Runtime type safety
- Consistent data structures

## File Upload

Services support file uploads for:
- Product images
- Business logos
- Expense receipts
- Employee documents

```typescript
// Upload file example
const fileUrl = await ApiService.uploadFile('bucket-name', 'path/file.jpg', file);
```

## Security

All services respect Supabase Row Level Security (RLS) policies:
- User authentication required
- Data access based on user roles
- Secure file uploads
- Input validation

## Best Practices

1. **Always use typed services** - Import from `../services` for type safety
2. **Handle errors gracefully** - Check for null/undefined returns
3. **Use filters efficiently** - Apply filters at the database level
4. **Validate input data** - Use service validation methods
5. **Cache when appropriate** - Use React Query or similar for caching

## Integration Examples

### Dashboard Component
```typescript
import { DashboardService } from '../services';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    const loadStats = async () => {
      const data = await DashboardService.getDashboardStats();
      setStats(data);
    };
    loadStats();
  }, []);
  
  // Render dashboard with stats
};
```

### Product Form
```typescript
import { ProductService } from '../services';

const ProductForm = () => {
  const handleSubmit = async (data) => {
    const validation = ProductService.validateProduct(data);
    if (validation.isValid) {
      const product = await ProductService.createProduct(data);
      // Handle success
    } else {
      // Handle validation errors
    }
  };
};
```

## Future Enhancements

- Real-time subscriptions for live data updates
- Advanced caching strategies
- Batch operations for bulk data processing
- Export/import functionality
- Advanced reporting and analytics
- Integration with external APIs (payment gateways, shipping, etc.) 