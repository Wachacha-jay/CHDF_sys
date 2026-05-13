import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiService, ApiError } from '../api';

// Mock Supabase client
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              range: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: { id: '1', name: 'Test' }, error: null }))
              }))
            }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: '1', name: 'Test' }, error: null }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: '1', name: 'Updated' }, error: null }))
            }))
          }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      }))
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: { path: 'test/path.jpg' }, error: null })),
        remove: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/test.jpg' } }))
      }))
    }
  }
}));

describe('ApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should fetch data successfully', async () => {
      const result = await ApiService.get('test_table');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: '1', name: 'Test' }]);
      expect(result.error).toBeNull();
    });

    it('should handle errors', async () => {
      const mockSupabase = await import('../../lib/supabase');
      mockSupabase.supabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                range: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Test error' } }))
                }))
              }))
            }))
          }))
        }))
      }));

      const result = await ApiService.get('test_table');
      
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Test error');
    });
  });

  describe('getById', () => {
    it('should fetch single record successfully', async () => {
      const result = await ApiService.getById('test_table', '1');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Test' });
      expect(result.error).toBeNull();
    });
  });

  describe('create', () => {
    it('should create record successfully', async () => {
      const testData = { name: 'New Test' };
      const result = await ApiService.create('test_table', testData);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Test' });
      expect(result.error).toBeNull();
    });
  });

  describe('update', () => {
    it('should update record successfully', async () => {
      const testData = { name: 'Updated Test' };
      const result = await ApiService.update('test_table', '1', testData);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Updated' });
      expect(result.error).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete record successfully', async () => {
      const result = await ApiService.delete('test_table', '1');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = await ApiService.uploadFile('test-bucket', 'test/path.jpg', file);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('https://example.com/test.jpg');
      expect(result.error).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const result = await ApiService.deleteFile('test-bucket', 'test/path.jpg');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(result.error).toBeNull();
    });
  });
});

describe('ApiError', () => {
  it('should create ApiError with message and status', () => {
    const error = new ApiError('Test error', 400, 'BAD_REQUEST');
    
    expect(error.message).toBe('Test error');
    expect(error.status).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.name).toBe('ApiError');
  });
}); 