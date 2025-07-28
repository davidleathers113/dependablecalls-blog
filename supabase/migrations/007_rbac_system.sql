-- RBAC System Migration
-- Creates roles, permissions, and user_roles tables with proper constraints and triggers

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create permissions table first (referenced by roles)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  conditions JSONB DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource, action)
);

-- Create roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN DEFAULT false, -- System roles cannot be deleted
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table for many-to-many relationship
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ, -- Optional role expiration
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  PRIMARY KEY (user_id, role_id)
);

-- Create indexes for better performance
CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_active ON roles(is_active);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_active ON user_roles(is_active);

-- Add updated_at triggers
CREATE TRIGGER update_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default permissions
INSERT INTO permissions (resource, action, description) VALUES
-- User management permissions
('users', 'create', 'Create new users'),
('users', 'read', 'View user information'),
('users', 'update', 'Update user information'),
('users', 'delete', 'Delete users'),
('users', 'list', 'List all users'),

-- Role management permissions
('roles', 'create', 'Create new roles'),
('roles', 'read', 'View role information'),
('roles', 'update', 'Update role information'),
('roles', 'delete', 'Delete roles'),
('roles', 'assign', 'Assign roles to users'),

-- Call management permissions
('calls', 'create', 'Create call records'),
('calls', 'read', 'View call information'),
('calls', 'update', 'Update call information'),
('calls', 'delete', 'Delete call records'),
('calls', 'list', 'List calls'),
('calls', 'export', 'Export call data'),

-- Campaign management permissions
('campaigns', 'create', 'Create campaigns'),
('campaigns', 'read', 'View campaign information'),
('campaigns', 'update', 'Update campaigns'),
('campaigns', 'delete', 'Delete campaigns'),
('campaigns', 'list', 'List campaigns'),
('campaigns', 'manage', 'Full campaign management'),

-- Marketplace permissions
('marketplace', 'browse', 'Browse marketplace listings'),
('marketplace', 'search', 'Search marketplace'),
('marketplace', 'purchase', 'Purchase from marketplace'),
('marketplace', 'list', 'Create marketplace listings'),
('marketplace', 'manage', 'Manage marketplace listings'),

-- Analytics permissions
('analytics', 'view', 'View analytics dashboards'),
('analytics', 'export', 'Export analytics data'),
('analytics', 'admin', 'View administrative analytics'),

-- Financial permissions
('transactions', 'create', 'Create transactions'),
('transactions', 'read', 'View transaction information'),
('transactions', 'list', 'List transactions'),
('transactions', 'approve', 'Approve transactions'),

-- System permissions
('system', 'monitor', 'Monitor system health'),
('system', 'configure', 'Configure system settings'),
('system', 'maintenance', 'Perform system maintenance'),
('system', 'backup', 'Perform system backups'),

-- Quality control permissions
('quality', 'view', 'View quality metrics'),
('quality', 'manage', 'Manage quality controls'),
('quality', 'dispute', 'Handle quality disputes'),

-- Commission permissions
('commissions', 'view', 'View commission information'),
('commissions', 'calculate', 'Calculate commissions'),
('commissions', 'approve', 'Approve commission payments');

-- Insert default roles with their permissions
INSERT INTO roles (name, description, permissions, is_system) VALUES
('buyer', 'Buyer user with marketplace access', '[
  {"resource": "marketplace", "action": "browse"},
  {"resource": "marketplace", "action": "search"},
  {"resource": "marketplace", "action": "purchase"},
  {"resource": "calls", "action": "read"},
  {"resource": "calls", "action": "list"},
  {"resource": "campaigns", "action": "create"},
  {"resource": "campaigns", "action": "read"},
  {"resource": "campaigns", "action": "update"},
  {"resource": "campaigns", "action": "list"},
  {"resource": "analytics", "action": "view"},
  {"resource": "transactions", "action": "read"},
  {"resource": "transactions", "action": "list"}
]', true),

('supplier', 'Supplier user with inventory management', '[
  {"resource": "marketplace", "action": "list"},
  {"resource": "marketplace", "action": "manage"},
  {"resource": "calls", "action": "create"},
  {"resource": "calls", "action": "read"},
  {"resource": "calls", "action": "update"},
  {"resource": "calls", "action": "list"},
  {"resource": "campaigns", "action": "read"},
  {"resource": "campaigns", "action": "list"},
  {"resource": "analytics", "action": "view"},
  {"resource": "transactions", "action": "read"},
  {"resource": "transactions", "action": "list"},
  {"resource": "quality", "action": "view"}
]', true),

('network', 'Network administrator with relationship management', '[
  {"resource": "users", "action": "read"},
  {"resource": "users", "action": "list"},
  {"resource": "calls", "action": "read"},
  {"resource": "calls", "action": "list"},
  {"resource": "campaigns", "action": "read"},
  {"resource": "campaigns", "action": "list"},
  {"resource": "marketplace", "action": "browse"},
  {"resource": "marketplace", "action": "manage"},
  {"resource": "analytics", "action": "view"},
  {"resource": "quality", "action": "view"},
  {"resource": "quality", "action": "manage"},
  {"resource": "quality", "action": "dispute"},
  {"resource": "commissions", "action": "view"},  
  {"resource": "commissions", "action": "calculate"},
  {"resource": "transactions", "action": "read"},
  {"resource": "transactions", "action": "list"},
  {"resource": "transactions", "action": "approve"}
]', true),

('admin', 'System administrator with full access', '[
  {"resource": "users", "action": "create"},
  {"resource": "users", "action": "read"},
  {"resource": "users", "action": "update"},
  {"resource": "users", "action": "delete"},
  {"resource": "users", "action": "list"},
  {"resource": "roles", "action": "create"},
  {"resource": "roles", "action": "read"},
  {"resource": "roles", "action": "update"},
  {"resource": "roles", "action": "delete"},
  {"resource": "roles", "action": "assign"},
  {"resource": "calls", "action": "create"},
  {"resource": "calls", "action": "read"},
  {"resource": "calls", "action": "update"},
  {"resource": "calls", "action": "delete"},
  {"resource": "calls", "action": "list"},
  {"resource": "calls", "action": "export"},
  {"resource": "campaigns", "action": "create"},
  {"resource": "campaigns", "action": "read"},
  {"resource": "campaigns", "action": "update"},
  {"resource": "campaigns", "action": "delete"},
  {"resource": "campaigns", "action": "list"},
  {"resource": "campaigns", "action": "manage"},
  {"resource": "marketplace", "action": "browse"},
  {"resource": "marketplace", "action": "manage"},
  {"resource": "analytics", "action": "view"},
  {"resource": "analytics", "action": "admin"},
  {"resource": "analytics", "action": "export"},
  {"resource": "transactions", "action": "create"},
  {"resource": "transactions", "action": "read"},
  {"resource": "transactions", "action": "list"},
  {"resource": "transactions", "action": "approve"},
  {"resource": "system", "action": "monitor"},
  {"resource": "system", "action": "configure"},
  {"resource": "system", "action": "maintenance"},
  {"resource": "system", "action": "backup"},
  {"resource": "quality", "action": "view"},
  {"resource": "quality", "action": "manage"},
  {"resource": "quality", "action": "dispute"},
  {"resource": "commissions", "action": "view"},
  {"resource": "commissions", "action": "calculate"},
  {"resource": "commissions", "action": "approve"}
]', true);

-- Add role column to users table if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='default_role') THEN
    ALTER TABLE users ADD COLUMN default_role VARCHAR(50) DEFAULT 'buyer';
  END IF;
END $$;

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permission(
  user_uuid UUID,
  resource_name VARCHAR(100),
  action_name VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
BEGIN
  -- Check if user has permission through any of their active roles
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid
      AND ur.is_active = true
      AND r.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND r.permissions @> jsonb_build_array(
        jsonb_build_object('resource', resource_name, 'action', action_name)
      )
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid UUID)
RETURNS TABLE (
  role_id UUID,
  role_name VARCHAR(50),
  role_description TEXT,
  assigned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.description,
    ur.assigned_at,
    ur.expires_at
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid
    AND ur.is_active = true
    AND r.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to assign role to user
CREATE OR REPLACE FUNCTION assign_user_role(
  target_user_id UUID,
  target_role_name VARCHAR(50),
  assigned_by_user_id UUID DEFAULT NULL,
  expires_at_param TIMESTAMPTZ DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  target_role_id UUID;
BEGIN
  -- Get role ID
  SELECT id INTO target_role_id
  FROM roles
  WHERE name = target_role_name AND is_active = true;
  
  IF target_role_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Insert or update user role assignment
  INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
  VALUES (target_user_id, target_role_id, assigned_by_user_id, expires_at_param)
  ON CONFLICT (user_id, role_id)
  DO UPDATE SET
    is_active = true,
    assigned_at = NOW(),
    assigned_by = assigned_by_user_id,
    expires_at = expires_at_param;
    
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on new tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles table
CREATE POLICY "Users can view all roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify roles"
  ON roles FOR ALL
  TO authenticated
  USING (check_user_permission(auth.uid(), 'roles', 'create'))
  WITH CHECK (check_user_permission(auth.uid(), 'roles', 'update'));

-- RLS Policies for permissions table
CREATE POLICY "Users can view all permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify permissions"
  ON permissions FOR ALL
  TO authenticated
  USING (check_user_permission(auth.uid(), 'roles', 'create'));

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR check_user_permission(auth.uid(), 'users', 'list'));

CREATE POLICY "Only authorized users can assign roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (check_user_permission(auth.uid(), 'roles', 'assign'));

CREATE POLICY "Only authorized users can update role assignments"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (check_user_permission(auth.uid(), 'roles', 'assign'));

CREATE POLICY "Only authorized users can remove role assignments"
  ON user_roles FOR DELETE
  TO authenticated
  USING (check_user_permission(auth.uid(), 'roles', 'assign'));

-- Update existing users table RLS policies for RBAC
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Enhanced RLS policies for users table
CREATE POLICY "Users can view own profile and admins can view all"
  ON users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    check_user_permission(auth.uid(), 'users', 'read') OR
    check_user_permission(auth.uid(), 'users', 'list')
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Only admins can create users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (check_user_permission(auth.uid(), 'users', 'create'));

CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (check_user_permission(auth.uid(), 'users', 'delete'));

-- Comments for documentation
COMMENT ON TABLE roles IS 'System roles with permissions for RBAC';
COMMENT ON TABLE permissions IS 'Available permissions for resources and actions';
COMMENT ON TABLE user_roles IS 'Many-to-many relationship between users and roles';
COMMENT ON FUNCTION check_user_permission IS 'Check if user has specific permission through their roles';
COMMENT ON FUNCTION get_user_roles IS 'Get all active roles for a user';
COMMENT ON FUNCTION assign_user_role IS 'Assign a role to a user with optional expiration';