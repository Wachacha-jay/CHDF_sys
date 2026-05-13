import React from 'react';
import { useAuthContext } from '../../contexts/useAuthContext';

interface PermissionGateProps {
  children: React.ReactNode;
  permission: string;
  fallback?: React.ReactNode;
}

const PermissionGate: React.FC<PermissionGateProps> = ({ children, permission, fallback = null }) => {
  const { user } = useAuthContext();

  // Super Admin bypasses all checks
  if (user?.role === 'Super Admin') {
    return <>{children}</>;
  }

  const hasPermission = user?.permissions?.includes(permission);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGate;
