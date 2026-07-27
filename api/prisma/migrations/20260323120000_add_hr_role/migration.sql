-- Add HR role to Role enum for HRMS RBAC
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HR';
