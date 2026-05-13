import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import crudRoutes from './routes/crud';
import rolesRoutes from './routes/roles';
import uploadRoutes from './routes/upload';
import purchasesRoutes from './routes/purchases';
import salesRoutes from './routes/sales';
import payrollRoutes from './routes/payroll';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payroll', payrollRoutes);
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Node Server is Running' });
});

app.use('/api', crudRoutes);


app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
