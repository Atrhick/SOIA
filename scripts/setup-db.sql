-- PostgreSQL Database Setup Script for StageOneInAction Back Office
-- Run this script as the postgres superuser after installing PostgreSQL

-- Create the application user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'stageoneinaction') THEN
        CREATE USER stageoneinaction WITH PASSWORD 'stageoneinaction_dev_2024';
    END IF;
END
$$;

-- Create the database
SELECT 'CREATE DATABASE stageoneinaction OWNER stageoneinaction'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'stageoneinaction')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE stageoneinaction TO stageoneinaction;

-- Connect to the new database and grant schema privileges
\c stageoneinaction
GRANT ALL ON SCHEMA public TO stageoneinaction;
