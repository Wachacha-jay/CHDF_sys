import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsCard from '../dashboard/StatsCard';
import { DollarSign } from 'lucide-react';

describe('StatsCard', () => {
  const defaultProps = {
    title: 'Test Title',
    value: '100',
    icon: DollarSign,
    color: 'blue' as const
  };

  it('renders with basic props', () => {
    render(<StatsCard {...defaultProps} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders with change indicator when provided', () => {
    const propsWithChange = {
      ...defaultProps,
      change: {
        value: 12,
        trend: 'up' as const
      }
    };

    render(<StatsCard {...propsWithChange} />);
    
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders with down trend', () => {
    const propsWithDownChange = {
      ...defaultProps,
      change: {
        value: 5,
        trend: 'down' as const
      }
    };

    render(<StatsCard {...propsWithDownChange} />);
    
    expect(screen.getByText('-5%')).toBeInTheDocument();
  });

  it('applies correct color classes for blue theme', () => {
    render(<StatsCard {...defaultProps} color="blue" />);
    
    const card = screen.getByText('Test Title').closest('div');
    expect(card).toHaveClass('bg-blue-50', 'text-blue-700', 'border-blue-200');
  });

  it('applies correct color classes for green theme', () => {
    render(<StatsCard {...defaultProps} color="green" />);
    
    const card = screen.getByText('Test Title').closest('div');
    expect(card).toHaveClass('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
  });

  it('applies correct color classes for red theme', () => {
    render(<StatsCard {...defaultProps} color="red" />);
    
    const card = screen.getByText('Test Title').closest('div');
    expect(card).toHaveClass('bg-red-50', 'text-red-700', 'border-red-200');
  });

  it('applies correct color classes for purple theme', () => {
    render(<StatsCard {...defaultProps} color="purple" />);
    
    const card = screen.getByText('Test Title').closest('div');
    expect(card).toHaveClass('bg-purple-50', 'text-purple-700', 'border-purple-200');
  });

  it('applies correct color classes for yellow theme', () => {
    render(<StatsCard {...defaultProps} color="yellow" />);
    
    const card = screen.getByText('Test Title').closest('div');
    expect(card).toHaveClass('bg-yellow-50', 'text-yellow-700', 'border-yellow-200');
  });

  it('renders icon with correct styling', () => {
    render(<StatsCard {...defaultProps} />);
    
    const iconContainer = screen.getByText('100').nextElementSibling;
    expect(iconContainer).toHaveClass('bg-blue-600');
  });

  it('handles numeric values', () => {
    render(<StatsCard {...defaultProps} value={1234} />);
    
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('handles string values', () => {
    render(<StatsCard {...defaultProps} value="KSh 1,234" />);
    
    expect(screen.getByText('KSh 1,234')).toBeInTheDocument();
  });

  it('does not render change indicator when not provided', () => {
    render(<StatsCard {...defaultProps} />);
    
    expect(screen.queryByText('vs last month')).not.toBeInTheDocument();
  });

  it('applies hover effects', () => {
    render(<StatsCard {...defaultProps} />);
    
    const card = screen.getByText('Test Title').closest('div');
    expect(card).toHaveClass('hover:shadow-md', 'transition-shadow');
  });
}); 