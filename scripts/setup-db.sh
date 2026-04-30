#!/bin/bash
# Creates the PostgreSQL database and user for the natives app
set -e

DB_NAME="${DB_NAME:-natives_db}"
DB_USER="${DB_USER:-postgres}"

echo "Setting up database: $DB_NAME"

# Create DB if it doesn't exist
psql -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
  || psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"

echo "Database '$DB_NAME' ready."
echo "Run: npm run seed-admin  to create your admin user."
